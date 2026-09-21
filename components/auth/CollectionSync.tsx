"use client";

import { useEffect, useRef } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchRemote, pushRemote } from "@/lib/supabase/collectionsSync";
import { readCollections, subscribeToCollections, writeCollections } from "@/lib/collections";
import { mergeLists, sameList } from "@/lib/mergeLists";

// 연달아 누를 때마다 서버로 보내지 않는다. 손을 멈추면 그때 한 번 보낸다.
const PUSH_DELAY_MS = 800;

/*
  이 기기의 목록과 계정의 목록을 이어 주는 자리. 화면에는 아무것도 그리지 않는다.

  로그인해도 화면은 계속 이 기기의 목록을 본다. 서버를 직접 읽게 하면
  목록마다 로딩이 생기고 오프라인에서 아무것도 못 한다. 대신 로그인할 때
  양쪽을 합치고, 그 뒤로는 바뀔 때마다 밀어 올린다.
*/
export function CollectionSync() {
  const userIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;

    let active = true;

    const pushNow = async () => {
      const userId = userIdRef.current;
      if (!userId) return;
      await pushRemote(supabase, userId, readCollections());
    };

    /** 로그인한 순간 한 번. 양쪽을 합쳐 기기와 계정을 같게 만든다. */
    const adopt = async (userId: string) => {
      const remote = await fetchRemote(supabase, userId);
      // 읽지 못했으면 아무것도 하지 않는다. 빈 목록으로 착각해 덮어쓰면
      // 다른 기기에서 담아둔 것이 사라진다.
      if (!active || !remote) return;

      const local = readCollections();
      const merged = {
        wishlist: mergeLists(local.wishlist, remote.wishlist),
        trip: mergeLists(local.trip, remote.trip),
      };

      writeCollections(merged);

      const remoteIsBehind =
        !sameList(merged.wishlist, remote.wishlist) || !sameList(merged.trip, remote.trip);
      if (remoteIsBehind) await pushRemote(supabase, userId, merged);
    };

    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      userIdRef.current = data.user.id;
      void adopt(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      const userId = session?.user?.id ?? null;

      if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        if (timerRef.current) clearTimeout(timerRef.current);
        /*
          로그아웃할 때 이 기기의 목록을 비운다.

          안 비우면 다음 사람이 이 브라우저에서 로그인했을 때 앞사람의
          목록이 그 사람 계정으로 합쳐진다. 공용 컴퓨터에서 실제로 일어난다.
          비워도 잃는 것은 없다 — 방금 계정에 올려 뒀다.
        */
        writeCollections({ wishlist: [], trip: [] });
        return;
      }
      if (!userId || userId === userIdRef.current) return;

      userIdRef.current = userId;
      void adopt(userId);
    });

    const unsubscribe = subscribeToCollections(() => {
      if (!userIdRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void pushNow(), PUSH_DELAY_MS);
    });

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      unsubscribe();
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
