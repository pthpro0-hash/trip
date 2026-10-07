"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchUnreadHeartCount, fetchUnreadReplyCount, fetchUnreadWishCount } from "@/lib/supabase/postcards";

/** 책장 화면이 답장·하트를 "봤다"고 표시했음을 위 띠에 알리는 신호. */
export const REPLIES_SEEN = "postcard-replies-seen";

/*
  새 소식(답장·하트·가고 싶은 곳)이 왔을 때만 위 띠에 나타나는 편지 표시.

  평소에는 아무것도 그리지 않는다 — 위 띠는 폰에서 이미 빠듯하고, 책장을 안 쓰는 사람에게는 없는 것이
  맞다. 부모님이 답장하거나 하트를 누르면 이 표시가 숫자와 함께 뜨고, 누르면 책장 화면(보낸 엽서)으로
  간다. 그 화면이 봤다고 표시하면 사라진다. 로그인하지 않았거나 수를 못 세면 조용히 없다.
  하트는 사람 한 명이 사진 스무 장에 눌러도 소식 하나로 센다.
*/
export function MailboxBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    const refresh = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (active) setCount(0);
          return;
        }
        const [replies, hearts, wishes] = await Promise.all([
          fetchUnreadReplyCount(supabase),
          fetchUnreadHeartCount(supabase),
          fetchUnreadWishCount(supabase),
        ]);
        if (active) setCount(replies + hearts + wishes);
      } catch {
        // 알림을 못 세면 없는 것처럼 둔다.
      }
    };

    void refresh();
    window.addEventListener(REPLIES_SEEN, refresh);
    return () => {
      active = false;
      window.removeEventListener(REPLIES_SEEN, refresh);
    };
  }, []);

  if (count <= 0) return null;

  return (
    <Link
      href="/mailboxes"
      aria-label={`가족 책장 새 소식 ${count}개`}
      className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-subtle text-[16px] transition hover:bg-line"
    >
      <span aria-hidden="true">✉️</span>
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#d70015] px-1 text-[11px] font-bold leading-none text-white"
      >
        {count > 9 ? "9+" : count}
      </span>
    </Link>
  );
}
