"use client";

import Link from "next/link";
import { rememberStart, startHref, type Start } from "@/lib/start";

/*
  가장 큰 갈래. 내 여행이냐, 여행 100선이냐.

  이 서비스는 두 몸이다 — 다녀온 길을 남기는 쪽과, 어디를 갈지 고르는
  쪽. 첫 화면에서 그 둘을 한 번에 고를 수 있게 크게 둔다.

  고른 쪽을 기억해 두었다가 다음에도 그쪽으로 연다(lib/start 참고).
*/

const OPTIONS: { value: Start; label: string }[] = [
  { value: "sketch", label: "내 여행" },
  { value: "spots", label: "여행 100선" },
];

interface StartSwitchProps {
  current: Start;
  /** 지도 위에 떠 있을 때. 지도가 비쳐 보여도 읽히게 그림자를 둔다. */
  floating?: boolean;
}

export function StartSwitch({ current, floating = false }: StartSwitchProps) {
  return (
    <nav
      aria-label="시작 갈래"
      className={`inline-flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line ${
        floating ? "shadow-[0_4px_16px_rgba(0,0,0,0.16)]" : ""
      }`}
    >
      {OPTIONS.map((option) => {
        const on = option.value === current;
        return (
          <Link
            key={option.value}
            href={startHref(option.value)}
            onClick={() => rememberStart(option.value)}
            aria-current={on ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-5 py-2 text-[15px] font-semibold transition ${
              on ? "bg-text text-bg" : "text-text-muted hover:bg-bg-subtle hover:text-text"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
