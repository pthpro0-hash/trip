"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { acceptInvite, type AcceptResult } from "@/lib/supabase/family";

const WHY: Record<Extract<AcceptResult, { ok: false }>["reason"], string> = {
  missing: "없는 초대예요. 링크를 다시 받아 주세요.",
  used: "이미 쓴 초대예요. 보낸 사람에게 새 링크를 받아 주세요.",
  expired: "기간이 지난 초대예요. 보낸 사람에게 새 링크를 받아 주세요.",
  own: "내가 만든 초대는 내가 수락할 수 없어요. 가족에게 보내 주세요.",
  full: "이 사람은 더 이상 가족을 들일 수 없어요(8명까지).",
  login: "로그인이 필요해요.",
  failed: "수락하지 못했어요. 잠시 뒤 다시 해 주세요.",
};

/** 초대를 수락하는 자리. token 이 null 이면 주소의 글자가 초대가 아니다. */
export function JoinCard({ token }: { token: string | null }) {
  const [result, setResult] = useState<AcceptResult | null>(token ? null : { ok: false, reason: "missing" });
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !token) return;
    setBusy(true);
    setResult(await acceptInvite(supabase, token));
    setBusy(false);
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-20 pt-10">
      <h1 className="text-[28px] font-bold tracking-tight text-text">가족 초대</h1>

      {result?.ok ? (
        <>
          <p className="text-[16px] leading-relaxed text-text">가족이 되었어요. 이제 초대한 사람의 여행을 함께 볼 수 있어요.</p>
          <Link
            href="/family"
            className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            가족 공유 보기
          </Link>
        </>
      ) : (
        <>
          <p className="text-[16px] leading-relaxed text-text-muted">
            이 초대를 수락하면 초대한 사람의 여행 기록을 함께 볼 수 있어요. 어디까지 할 수 있는지는 그 사람이 정한 권한을
            따라요. 언제든 나갈 수 있어요.
          </p>
          {result && <p role="alert" className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">{WHY[result.reason]}</p>}
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
