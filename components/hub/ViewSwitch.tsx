"use client";

import type { MyView } from "@/lib/nav";

/*
  내 여행의 두 모습 — 지도와 목록.

  같은 여행을 지도로 보거나 목록으로 본다. 예전에는 목록이 따로 선 화면(/trips)이라
  "내 스케치"라는 이름이 두 화면에 붙었다. 지금은 한 화면에서 이 스위치로 오간다.

  이미 켜진 쪽을 눌러도 아무 일이 없다. 켜진 것을 다시 누르는 손은 "여기가 맞나"를
  확인하는 손이라, 화면이 다시 그려지면 오히려 놓친다.
*/

const OPTIONS: { value: MyView; label: string }[] = [
  { value: "map", label: "지도" },
  { value: "list", label: "목록" },
];

interface ViewSwitchProps {
  view: MyView;
  onChange: (next: MyView) => void;
}

export function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  return (
    <div
      role="radiogroup"
      aria-label="보기 방식"
      className="inline-flex shrink-0 gap-0.5 rounded-full bg-bg-subtle p-0.5 ring-1 ring-line"
    >
      {OPTIONS.map((option) => {
        const on = option.value === view;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (!on) onChange(option.value);
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
              on ? "bg-text text-bg" : "text-text-muted hover:text-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
