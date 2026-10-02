"use client";

import { useState } from "react";
import { GREETING_NAME_MAX, NAME_MAX, normalizeMembers, suggestionsFor, type Tone } from "@/lib/mailbox";
import type { MailboxInput } from "@/lib/supabase/mailbox";

/*
  우편함 하나의 모습을 정하는 칸들. 만들 때와 고칠 때 같이 쓴다.

    이름        내가 구분하려고 붙이는 이름("우리 엄마 아빠")
    부르는 말   인사말 맨 앞에 저절로 붙는다("엄마 아빠, …")
    받는 분     받는 쪽에서 "누가 보시나요?"로 고르는 이름들(비우면 부르는 말에서)
    말투        존댓말이면 보낼 때 존대 인사 추천 문구가 뜬다(자동으로 바꾸지는 않는다)
*/

interface MailboxFormProps {
  initial?: Partial<MailboxInput>;
  submitLabel: string;
  busy: boolean;
  onSubmit: (input: MailboxInput) => void;
  onCancel: () => void;
}

export function MailboxForm({ initial, submitLabel, busy, onSubmit, onCancel }: MailboxFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [greetingName, setGreetingName] = useState(initial?.greetingName ?? "");
  const [members, setMembers] = useState(initial?.members ?? "");
  const [tone, setTone] = useState<Tone>(initial?.tone ?? "casual");
  const [useGreeting, setUseGreeting] = useState(initial?.useGreeting ?? true);

  const shown = normalizeMembers(members || greetingName);
  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) onSubmit({ name, greetingName, members, tone, useGreeting });
      }}
      className="flex flex-col gap-3 rounded-xl bg-bg p-3.5 ring-1 ring-line"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-text-muted">우편함 이름</span>
        <input
          type="text"
          value={name}
          maxLength={NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          placeholder="우리 엄마 아빠"
          className="rounded-lg bg-bg-subtle px-3 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <span className="text-[12px] text-text-faint">나만 알아보면 돼요. 받는 분에게는 보이지 않아요.</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-text-muted">부르는 말</span>
        <input
          type="text"
          value={greetingName}
          maxLength={GREETING_NAME_MAX}
          onChange={(event) => setGreetingName(event.target.value)}
          placeholder="엄마 아빠"
          className="rounded-lg bg-bg-subtle px-3 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <span className="text-[12px] text-text-faint">인사말 맨 앞에 붙어요. 예: &ldquo;엄마 아빠, 바다 보고 왔어요&rdquo;</span>
      </label>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={useGreeting}
          onChange={(event) => setUseGreeting(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-[14px] text-text">인사말 앞에 부르는 말을 붙이기</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-text-muted">받는 분 이름</span>
        <input
          type="text"
          value={members}
          onChange={(event) => setMembers(event.target.value)}
          placeholder="엄마, 아빠"
          className="rounded-lg bg-bg-subtle px-3 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <span className="text-[12px] text-text-faint">
          받는 분이 처음 열 때 &ldquo;누가 보시나요?&rdquo;에서 고르는 이름이에요. 비우면 부르는 말에서 만들어요.
        </span>
        {shown.length > 0 && (
          <span className="flex flex-wrap gap-1.5" aria-label="받는 분 미리보기">
            {shown.map((member) => (
              <span key={member} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] text-accent">
                {member}
              </span>
            ))}
          </span>
        )}
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[13px] font-medium text-text-muted">말투</legend>
        <div role="radiogroup" aria-label="말투" className="flex gap-2">
          {(
            [
              ["casual", "편하게"],
              ["polite", "존댓말"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-center text-[14px] font-medium ring-1 transition ${
                tone === value ? "bg-accent-soft text-accent ring-accent" : "bg-bg text-text-muted ring-line"
              }`}
            >
              <input
                type="radio"
                name="tone"
                value={value}
                checked={tone === value}
                onChange={() => setTone(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <span className="text-[12px] text-text-faint">
          {tone === "polite"
            ? `보낼 때 추천 문구가 떠요. 예: “${suggestionsFor("polite")[0]}” (말을 자동으로 바꾸지는 않아요)`
            : "보낼 때 편한 추천 문구가 떠요."}
        </span>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-bg-subtle px-4 py-2.5 text-[14px] font-medium text-text-muted hover:bg-line"
        >
          그만두기
        </button>
      </div>
    </form>
  );
}
