"use client";

import { useEffect, useRef, useState } from "react";

/*
  지도 위 왼쪽의 "지도 옵션".

  예전에는 칩 둘("시도 3/17", "100선 겹쳐 보기")이 늘 떠 있었다. 처음 보는 사람에게는 "시도 3/17"이 무엇을 세는 것인지,
  "100선 겹쳐 보기"가 켜고 끄는 것인지 알기 어렵고, 지도를 가리는 것이 둘이었다. 지금은 단추 하나다. 눌러야 두 가지가
  나온다 — 다녀온 시도(밟은 시도를 세어 본다)와 100선 겹쳐 보기(스위치).

  시도 수는 단추 옆이 아니라 눌러서 나오는 첫 줄에 둔다. 한 번만 누르면 보인다.

  100선을 겹쳐 보는 동안에는 창이 닫혀 있어도 범례가 남는다 — 지도에 뜬 빈 동그라미와 채운 동그라미가 무엇인지
  알려야 하고, 켜 둔 것이 단추의 켜진 모습으로도 보인다. 고르면 창은 닫는다(지도를 가리지 않게).
*/

interface MapOptionsProps {
  /** 다녀온 시도 수. 경계를 아직 받아 오는 중이면 null. */
  sidoCount: number | null;
  /** 100선 겹쳐 보기가 켜져 있는가. */
  curatedOn: boolean;
  /** 다녀온 시도를 펼친다. */
  onSido: () => void;
  /** 100선 겹쳐 보기를 켜고 끈다. */
  onCurated: () => void;
}

const CARD = "pointer-events-auto shadow-[0_2px_10px_rgba(0,0,0,0.15)]";

export function MapOptions({ sidoCount, curatedOn, onSido, onCurated }: MapOptionsProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // 열려 있는 동안만 바깥을 누르거나 Esc 를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={root} className="flex flex-col items-start gap-2">
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`${CARD} flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition ${
            curatedOn
              ? "bg-accent text-on-accent ring-accent"
              : "bg-surface text-text ring-line hover:bg-bg-subtle"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="17" r="2" />
          </svg>
          지도 옵션
        </button>

        {open && (
          <div
            role="group"
            aria-label="지도 옵션"
            className="pointer-events-auto absolute left-0 top-full z-10 mt-2 w-[228px] overflow-hidden rounded-2xl bg-surface shadow-[0_6px_24px_rgba(0,0,0,0.18)] ring-1 ring-line"
          >
            <button
              type="button"
              onClick={choose(onSido)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[14px] font-medium text-text transition hover:bg-bg-subtle"
            >
              <span>다녀온 시도 {sidoCount ?? "…"}/17</span>
              <span aria-hidden="true" className="text-[16px] text-text-faint">
                ›
              </span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={curatedOn}
              onClick={choose(onCurated)}
              className="flex w-full items-center justify-between gap-3 border-t border-line px-4 py-3 text-left text-[14px] font-medium text-text transition hover:bg-bg-subtle"
            >
              <span>100선 겹쳐 보기</span>
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 shrink-0 rounded-full transition ${curatedOn ? "bg-accent" : "bg-line-strong"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${
                    curatedOn ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </div>
        )}
      </div>

      {curatedOn && (
        <p className="pointer-events-auto rounded-lg bg-surface/95 px-2.5 py-1.5 text-[11px] leading-relaxed text-text-muted shadow-sm ring-1 ring-line">
          <span
            aria-hidden="true"
            className="mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-accent bg-white align-[-1px]"
          />
          아직 안 간 곳
          <span
            aria-hidden="true"
            className="ml-2 mr-1 inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-accent align-[-1px]"
          />
          가고 싶은 곳
        </p>
      )}
    </div>
  );
}
