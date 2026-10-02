"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchUnreadReplyCount } from "@/lib/supabase/postcards";

/** 우편함 화면이 답장을 "봤다"고 표시했음을 위 띠에 알리는 신호. */
export const REPLIES_SEEN = "postcard-replies-seen";

/*
  새 답장이 왔을 때만 위 띠에 나타나는 편지 표시.

  평소에는 아무것도 그리지 않는다 — 위 띠는 폰에서 이미 빠듯하고, 우편함을 안 쓰는 사람에게는 없는 것이
  맞다. 부모님이 답장하면 이 표시가 숫자와 함께 뜨고, 누르면 우편함 화면(보낸 엽서)으로 간다. 그 화면이
  답장을 봤다고 표시하면 사라진다. 로그인하지 않았거나 수를 못 세면 조용히 없다.
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
        const unread = await fetchUnreadReplyCount(supabase);
        if (active) setCount(unread);
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
      aria-label={`가족 우편함 새 답장 ${count}개`}
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
