"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { signedUrls } from "@/lib/supabase/photos";

/*
  크게 볼 사진의 주소를 미리 받아 둔다.

  예전에는 사진을 넘길 때마다 그 한 장의 서명 주소를 서버에 물어 오느라, 넘긴 뒤에도 한참 비어 있었다(주소 한 번 + 사진 한 번,
  왕복이 둘). 보고 있는 자리 앞뒤 몇 장의 주소를 한 번에 묻고(한 번의 요청), 이미 받은 것은 다시 묻지 않는다. 그러면 넘기는 순간에는
  주소가 이미 있어 사진만 받으면 되고, 그 사진도 뷰어가 미리 받아 둔다(components/trip/PhotoViewer).
*/

/** 보고 있는 자리에서 앞(다음 쪽)으로 미리 받을 장 수. 넘기는 쪽은 대개 앞이다. */
const AHEAD = 3;
/** 뒤(이전 쪽)로 미리 받을 장 수. */
const BEHIND = 1;

/** 보고 있는 자리 앞뒤로 미리 받을 사진의 번호들. 끝에서 넘기면 처음으로 돌므로 돌려서 센다. 보고 있는 것이 맨 앞이다. */
export function nearIndexes(current: number, total: number): number[] {
  if (total <= 0) return [];
  const order = [0];
  for (let step = 1; step <= Math.max(AHEAD, BEHIND); step += 1) {
    if (step <= AHEAD) order.push(step);
    if (step <= BEHIND) order.push(-step);
  }
  const wanted = order.map((offset) => (((current + offset) % total) + total) % total);
  return [...new Set(wanted)];
}

/**
 * 크게 볼 사진들(보관 경로)의 주소. 돌려주는 함수는 번호로 주소를 찾고, 아직 받지 못했으면 null.
 * viewing 이 null 이면 아무것도 묻지 않는다(보고 있지 않을 때는 받을 까닭이 없다).
 */
export function useBigPhotos(paths: string[], viewing: number | null): (index: number) => string | null {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  // 이미 물은 것(받았거나 받는 중). 다시 묻지 않는다. 받지 못한 것은 여기서 빼 다음에 다시 물을 수 있게 한다.
  const asked = useRef(new Set<string>());
  const alive = useRef(true);
  // 목록이 같은지는 내용으로 본다 — 부르는 쪽이 그릴 때마다 새 배열을 건네도 다시 돌지 않게. 보관 경로에는 줄바꿈이 없다.
  const key = paths.join("\n");

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (viewing === null) return;
    const list = key === "" ? [] : key.split("\n");
    const wanted = nearIndexes(viewing, list.length)
      .map((index) => list[index])
      .filter((path) => path && !asked.current.has(path));
    if (wanted.length === 0) return;

    const supabase = getBrowserClient();
    if (!supabase) return;

    for (const path of wanted) asked.current.add(path);
    const forget = (paths: string[]) => {
      for (const path of paths) asked.current.delete(path);
    };

    signedUrls(supabase, wanted).then(
      (got) => {
        forget(wanted.filter((path) => !got.has(path)));
        if (!alive.current || got.size === 0) return;
        setUrls((now) => {
          const next = new Map(now);
          for (const [path, url] of got) next.set(path, url);
          return next;
        });
      },
      () => forget(wanted),
    );
  }, [viewing, key]);

  return (index: number) => {
    const path = paths[index];
    return path ? (urls.get(path) ?? null) : null;
  };
}
