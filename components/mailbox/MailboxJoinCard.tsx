"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { acceptMailboxInvite, type AcceptMailboxResult } from "@/lib/supabase/mailbox";
import { MAILBOX_SENDER_LIMIT } from "@/lib/mailbox";

const WHY: Record<Extract<AcceptMailboxResult, { ok: false }>["reason"], string> = {
  missing: "없는 초대예요. 링크를 다시 받아 주세요.",
  used: "이미 쓴 초대예요. 보낸 사람에게 새 링크를 받아 주세요.",
  expired: "기간이 지난 초대예요. 보낸 사람에게 새 링크를 받아 주세요.",
  closed: "닫힌 책장이에요. 만든 사람에게 물어봐 주세요.",
  full: `이 책장에는 보내는 사람이 ${MAILBOX_SENDER_LIMIT}명까지예요.`,
  login: "로그인이 필요해요.",
  failed: "수락하지 못했어요. 잠시 뒤 다시 해 주세요.",
};

/** 보내는 사람 초대를 수락하는 자리. token 이 null 이면 주소의 글자가 초대가 아니다. */
export function MailboxJoinCard({ token }: { token: string | null }) {
  const [result, setResult] = useState<AcceptMailboxResult | null>(token ? null : { ok: false, reason: "missing" });
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !token) return;
    setBusy(true);
    setResult(await acceptMailboxInvite(supabase, token));
    setBusy(false);
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-20 pt-10">
      <h1 className="text-[28px] font-bold tracking-tight text-text">가족 책장 초대</h1>

      {result?.ok ? (
        <>
          <p className="text-[16px] leading-relaxed text-text">이제 이 책장에 엽서를 보낼 수 있어요.</p>
          <Link
            href="/mailboxes"
            className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            내 책장 보기
          </Link>
        </>
      ) : (
        <>
          <p className="text-[16px] leading-relaxed text-text-muted">
            초대를 수락하면 이 가족 책장에 내 여행 엽서를 보낼 수 있어요. 책장을 고치거나 닫는 것은 만든 사람만 할 수
            있고, 언제든 나갈 수 있어요.
          </p>
          {result && (
            <p role="alert" className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
              {WHY[result.reason]}
            </p>
          )}
          {token && (
            <button
              type="button"
              onClick={() => void accept()}
              disabled={busy}
              className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              초대 수락하기
            </button>
          )}
          <Link href="/" className="self-start text-[14px] text-text-muted hover:text-text">
            수락하지 않고 나가기
          </Link>
        </>
      )}
    </main>
  );
}
