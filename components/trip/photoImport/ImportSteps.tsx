/*
  사진으로 여행을 추가하는 세 걸음 — 고르기 · 확인 · 기록.

  지금 어디쯤인지, 앞으로 몇 걸음이 남았는지가 늘 보이면 "이거 언제 끝나지?" 하는 불안이 줄어든다. 사진을 고르고
  나면 화면이 길게 늘어나는데(여행 카드 열 장), 그 끝에 단추가 있다는 것을 걸음 표시가 미리 알려 준다.
*/

const STEPS = ["고르기", "확인", "기록"] as const;

const DOT = {
  done: "bg-accent-soft text-accent",
  now: "bg-accent text-on-accent",
  next: "bg-bg-subtle text-text-faint",
} as const;

export function ImportSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="진행 단계" className="flex items-center text-[13px]">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const state = step < current ? "done" : step === current ? "now" : "next";
        return (
          <li key={label} aria-current={state === "now" ? "step" : undefined} className="flex items-center">
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${DOT[state]}`}
              >
                {state === "done" ? "✓" : step}
              </span>
              <span className={state === "now" ? "font-semibold text-text" : "text-text-faint"}>{label}</span>
              {state === "done" && <span className="sr-only">완료</span>}
            </span>
            {index < STEPS.length - 1 && <span aria-hidden="true" className="mx-2 h-px w-6 bg-line sm:w-8" />}
          </li>
        );
      })}
    </ol>
  );
}
