"use client";

import { useId, useState } from "react";
import { normalizeMembers, suggestionsFor, type Tone } from "@/lib/mailbox";

/*
  처음 엽서를 보내는 사람에게 묻는 두 가지.

  책장이 없으면 엽서를 보낼 수 없는데, 책장을 만들려면 /mailboxes 로 떠나 다섯 칸을 채우고 돌아와야 했다. 여기서는 엽서 창
  안에서 "누구에게 보내나요?"와 말투만 묻는다. 책장 이름 · 부르는 말 · 받는 분 이름은 그 답에서 만든다(lib/mailboxFirst).
  나머지 설정은 권장값이고, 바꾸는 것은 나중에 한다.

  이 컴포넌트는 묻기만 한다. 책장을 실제로 만드는 것은 부르는 쪽(SendPostcardDialog)이다.
*/

interface FirstShelfFormProps {
  /** 만드는 중이면 단추를 막는다. */
  busy: boolean;
  /** 지난 시도가 실패한 까닭. */
  error: string | null;
  onSubmit: (answer: { who: string; tone: Tone }) => void;
}

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "편하게" },
  { value: "polite", label: "존댓말" },
];

export function FirstShelfForm({ busy, error, onSubmit }: FirstShelfFormProps) {
  const [who, setWho] = useState("");
  const [tone, setTone] = useState<Tone>("casual");
  const [missing, setMissing] = useState(false);
  const whoId = useId();

  const names = normalizeMembers(who);
  const problem = missing ? "받는 분을 적어 주세요. 예: 엄마, 아빠" : error;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        // 눌렀을 때 무엇이 빠졌는지 말로 알린다. 단추를 흐리게 막아 두면 눌러도 아무 일이 없어 고장 난 것처럼 보인다.
        if (names.length === 0) {
          setMissing(true);
          return;
        }
        onSubmit({ who, tone });
      }}
      className="flex flex-col gap-5"
    >
      {/* 오른쪽 위의 ✕ 를 피해 제목만 오른쪽을 비운다. */}
      <div className="pr-9">
        <h2 className="text-[20px] font-bold tracking-tight text-text">부모님께 엽서 보내기</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-text-muted">먼저 받는 분을 알려 주세요. 한 번만 하면 돼요.</p>
      </div>

      {/* 이름표는 질문만 감싼다. 아래의 예·알아들은 이름까지 감싸면 입력칸의 이름이 길어진다. */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={whoId} className="text-[14px] font-semibold text-text">
          누구에게 보내나요?
        </label>
        <input
          id={whoId}
          type="text"
          value={who}
          onChange={(event) => {
            setWho(event.target.value);
            setMissing(false);
          }}
          placeholder="엄마, 아빠"
          className="rounded-xl bg-bg-subtle px-3.5 py-3 text-[16px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        {names.length > 0 ? (
          <span aria-label="받는 분 미리보기" className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <span key={name} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] text-accent">
                {name}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-[12px] text-text-faint">예: 엄마, 아빠 · 장인 장모님 · 할머니</span>
        )}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[14px] font-semibold text-text">말투</legend>
        <div role="radiogroup" aria-label="말투" className="flex gap-2">
          {TONES.map((option) => (
            <label
              key={option.value}
              className={`flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-center text-[15px] font-medium ring-1 transition ${
                tone === option.value ? "bg-accent-soft text-accent ring-accent" : "bg-bg text-text-muted ring-line"
              }`}
            >
              <input
                type="radio"
                name="first-shelf-tone"
                value={option.value}
                checked={tone === option.value}
                onChange={() => setTone(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        <span className="text-[12px] text-text-faint">
          {tone === "polite"
            ? `보낼 때 존댓말 추천 문구가 떠요. 예: “${suggestionsFor("polite")[0]}”`
            : "보낼 때 편한 추천 문구가 떠요."}
        </span>
      </fieldset>

      {problem && (
        <p role="alert" className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          {problem}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "만드는 중…" : "다음"}
        </button>
        <p className="text-center text-[12px] text-text-faint">
          나머지 설정은 나중에 &lsquo;내 정보&rsquo;의 &lsquo;가족 책장&rsquo;에서 바꿀 수 있어요.
        </p>
      </div>
    </form>
  );
}
