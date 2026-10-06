"use client";

import { keepWho, useWho } from "@/lib/mailboxWho";

/*
  "누가 보시나요?" — 우편함을 같이 쓰는 분들 중 한 분을 고른다. 처음 한 번이면 이 폰이 기억한다.
  받는 분 이름이 정해져 있지 않은 우편함(members 가 빔)에서는 그리지 않는다.
*/
export function WhoPicker({ token, members, compact = false }: { token: string; members: string[]; compact?: boolean }) {
  const who = useWho(token);
  if (members.length === 0) return null;

  if (who && compact) {
    return (
      <p className="rs-16 text-text-muted">
        <span className="font-semibold text-text">{who}</span>(으)로 보고 계세요.{" "}
        <button
          type="button"
          onClick={() => keepWho(token, "")}
          className="font-medium text-accent underline underline-offset-4"
        >
          바꾸기
        </button>
      </p>
    );
  }
  if (who) return null;

  return (
    <section aria-label="누가 보시나요?" className="flex flex-col gap-3 rounded-2xl bg-accent-soft p-5">
      <p className="rs-20 font-bold text-text">누가 보시나요?</p>
      <p className="rs-16 leading-relaxed text-text-muted">한 번만 골라 두면, 답장에 이름이 붙어요.</p>
      <div className="flex flex-wrap gap-3">
        {members.map((member) => (
          <button
            key={member}
            type="button"
            onClick={() => keepWho(token, member)}
            className="min-h-14 min-w-28 rounded-2xl bg-bg px-6 rs-20 font-semibold text-text ring-1 ring-line transition hover:bg-bg-subtle"
          >
            {member}
          </button>
        ))}
      </div>
    </section>
  );
}
