"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  fromSearchEngine,
  markWelcomeShown,
  readWelcomeState,
  shouldShowWelcome,
  snoozeWelcomeToday,
} from "@/lib/welcome";

/*
  처음 온 사람(로그인 전)에게 이 서비스가 무엇을 해 주는지를 한 번 말해 주는 팝업.

  첫 화면 맨 위에 환영 영역(약속 한 줄·예시 그림)을 끼워 넣었더니 아래 여행 100선이 밀려 내려가고, 영역이 구분되지
  않아 혼잡해 보였다. 그래서 뒤를 어둡게 하는 팝업 하나로 둔다. 예전에는 안내 창이 둘(사용법, 내 여행 안내)이었고 어느 화면에서든
  떴다 — 이제 하나이고, 여행 100선 첫 화면(app/page)에서만, 로그인 전 사람에게만 뜬다.

  언제 뜨고 안 뜨는지는 lib/welcome 이 정한다: 이번 방문에 한 번, "오늘 그만 보기"는 오늘 하루, 검색에서 바로 넘어온
  사람에게는 안 뜬다. 브라우저에서만 그려서(처음에는 아무것도 그리지 않는다) 서버가 보내는 본문에는 들어가지 않는다.

  안심 한 줄은 정확해야 한다: 고르는 동안(읽는 동안)은 사진이 기기 밖으로 나가지 않지만, 기록할 때 사진도 함께
  올리기를 고르면 올라간다. "올라가지 않아요"라고 하면 틀린 약속이 된다.
*/

/** 아직 로그인하지 않았나. 물어볼 수 없는 곳이면 로그인이 없는 곳이라 로그인 전으로 본다. 물었다가 실패하면 모른다 — 내밀지 않는다. */
async function isLoggedOut(): Promise<boolean> {
  const supabase = getBrowserClient();
  if (!supabase) return true;
  try {
    const { data } = await supabase.auth.getUser();
    return !data.user;
  } catch {
    return false;
  }
}

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const STEPS: { label: string; icon: ReactNode }[] = [
  {
    label: "사진 고르기",
    icon: (
      <Glyph>
        <rect x="4" y="5" width="16" height="14" rx="2.5" />
        <path d="M4 15.5l4.2-4.2 4 4 3-3L20 16" />
        <circle cx="9" cy="9.5" r="1.2" />
      </Glyph>
    ),
  },
  {
    label: "저절로 정리",
    icon: (
      <Glyph>
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </Glyph>
    ),
  },
  {
    label: "지도·한 장 카드",
    icon: (
      <Glyph>
        <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </Glyph>
    ),
  },
];

export function WelcomeDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      // 저장소를 못 읽으면 내밀지 않는다(닫아도 기억하지 못해 올 때마다 뜬다).
      const state = readWelcomeState();
      if (!state) return;
      // 검색에서 바로 넘어온 사람에게는 이번 방문 내내 내밀지 않는다. 새로 고쳐 출처가 사라져도 그렇다.
      if (fromSearchEngine(document.referrer)) {
        markWelcomeShown();
        return;
      }
      if (!shouldShowWelcome(state)) return;

      if (!(await isLoggedOut())) return;
      if (!active) return;
      // 이번 방문에 내밀었다고 적는다 — 나중에를 누르거나 새로 고쳐도 같은 방문에는 다시 뜨지 않는다.
      markWelcomeShown();
      setOpen(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    // 읽는 동안 뒤가 따라 움직이면 어지럽다.
    const kept = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = kept;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={close}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        tabIndex={-1}
        // 안쪽을 누른 것까지 닫힘으로 세지 않는다.
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-3xl bg-surface p-6 shadow-xl ring-1 ring-line outline-none"
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg-subtle text-[16px] text-text-muted transition hover:bg-line hover:text-text"
        >
          <span aria-hidden="true">✕</span>
        </button>

        <div className="pr-8">
          <p className="text-[13px] font-semibold text-accent">내 여행 스케치</p>
          <h2 id="welcome-title" className="mt-1 text-[26px] font-bold leading-[1.3] tracking-tight text-text">
            사진만 고르면,{" "}
            <br />
            여행이 정리돼요
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
            날짜와 장소로 묶고, 지도와 한 장짜리 카드로 만들어 드려요.
          </p>
        </div>

        <ol aria-label="이렇게 돼요" className="grid grid-cols-3 gap-2">
          {STEPS.map((step, index) => (
            <li key={step.label} className="relative flex flex-col items-center gap-1.5 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">{step.icon}</span>
              <span className="text-[12px] font-medium leading-tight text-text-muted">{step.label}</span>
              {index < STEPS.length - 1 && (
                <span aria-hidden="true" className="absolute -right-2 top-2.5 text-[16px] text-text-faint">
                  ›
                </span>
              )}
            </li>
          ))}
        </ol>

        <Link
          href="/trips/new"
          onClick={close}
          className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition hover:bg-accent-hover"
        >
          사진 고르기
        </Link>

        <div className="flex items-start gap-1.5 text-[13px] leading-snug text-text-muted">
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="mt-px h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          <p>
            고르는 동안 사진은 이 기기 밖으로 나가지 않아요
            <br />
            <span className="text-text-faint">기록으로 남길 때 로그인해요</span>
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3 text-[14px]">
          <button
            type="button"
            onClick={() => {
              snoozeWelcomeToday();
              close();
            }}
            className="text-text-faint underline-offset-2 transition hover:text-text hover:underline"
          >
            오늘 그만 보기
          </button>
          <button type="button" onClick={close} className="font-medium text-text-muted transition hover:text-text">
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
