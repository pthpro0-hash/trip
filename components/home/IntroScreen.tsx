"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AddPhotosLink } from "@/components/photo/AddPhotosLink";
import { fromSearchEngine, markWelcomeShown } from "@/lib/welcome";
import { markIntroSeen, readIntroSeen, shouldShowIntro } from "@/lib/intro";
import { hasSessionCookieHere } from "@/lib/sessionCookie";

/*
  처음 온 사람에게 한 번만 뜨는 전체 화면 소개. 2초 남짓한 장면 — 사진 → 지도 위의 길과 핀 → 한 장 카드 — 이 차례로 나타난 뒤
  멈춘다. 동영상 파일이 아니라 화면에서 그려서(CSS) 가볍고, 어떤 화면에서도 또렷하다. 움직임을 줄인 기기에서는 마지막 그림이
  처음부터 보인다.

  언제 뜨는지는 lib/intro 가 정한다: 이 기기에서 한 번, 검색에서 바로 넘어온 사람·로그인한 사람에게는 안 뜬다. 브라우저에서만
  그려서(처음에는 아무것도 그리지 않는다) 서버가 보내는 본문과 검색엔진에는 들어가지 않는다.

  뜨면 환영 팝업(WelcomeDialog)은 이번 방문에 내밀었다고 적어 겹치지 않게 한다. 두 컴포넌트의 효과는 앞서 놓인 쪽이 먼저
  돌므로, app/page 에서 이 컴포넌트를 팝업보다 앞에 둔다.
*/

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

const FEATURES: { text: string; icon: ReactNode }[] = [
  {
    text: "사진은 이 기기 안에서 읽어요",
    icon: (
      <Glyph>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </Glyph>
    ),
  },
  {
    text: "다녀온 길이 지도 위에 그려져요",
    icon: (
      <Glyph>
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </Glyph>
    ),
  },
  {
    text: "부모님께는 링크 하나로 보여 드려요",
    icon: (
      <Glyph>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </Glyph>
    ),
  },
];

/** 한 장 카드가 만들어지는 모습. 장식이라 스크린리더에는 읽히지 않는다. */
function Scene({ photos }: { photos: string[] }) {
  const tiles = photos.slice(0, 3);
  return (
    <div aria-hidden="true" className="relative mx-auto h-[262px] w-full max-w-[300px]">
      {tiles.map((url, index) => (
        <div
          key={url}
          className="intro-pop absolute top-0 h-[100px] w-[88px] overflow-hidden rounded-2xl bg-bg-subtle shadow-lg ring-2 ring-surface"
          style={{ left: 4 + index * 102, ["--r" as string]: `${(index - 1) * 5}deg`, ["--d" as string]: `${index * 0.18}s` }}
        >
          <Image src={url} alt="" fill sizes="88px" className="object-cover" priority />
        </div>
      ))}

      <div
        className="intro-pop absolute inset-x-0 top-[116px] h-[146px] overflow-hidden rounded-3xl bg-surface shadow-[0_10px_30px_-12px_rgba(20,40,80,0.35)] ring-1 ring-line"
        style={{ ["--d" as string]: "0.7s" }}
      >
        <svg viewBox="0 0 300 146" className="h-full w-full">
          <rect width="300" height="146" className="fill-bg-subtle" />
          <path d="M0 96 C60 70 90 120 160 100 S260 60 300 80 V146 H0Z" className="fill-accent-soft" />
          <path
            d="M40 104 Q95 22 150 74 T262 40"
            pathLength={1}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className="intro-draw stroke-accent"
            style={{ ["--d" as string]: "1.1s" }}
          />
          {[
            [40, 104, "1.1s"],
            [150, 74, "1.5s"],
            [262, 40, "1.9s"],
          ].map(([x, y, d]) => (
            <circle
              key={String(x)}
              cx={x}
              cy={y}
              r="8"
              strokeWidth="4"
              className="intro-pin fill-accent stroke-surface"
              style={{ ["--d" as string]: String(d) }}
            />
          ))}
        </svg>
        <p
          className="intro-pop absolute bottom-3 left-3 rounded-full bg-surface px-3 py-1.5 text-[12px] font-semibold text-text shadow ring-1 ring-line"
          style={{ ["--d" as string]: "2s" }}
        >
          속초 외 2곳 · 사진 6장
        </p>
      </div>
    </div>
  );
}

export function IntroScreen({ photos }: { photos: string[] }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seen = readIntroSeen();
    const show = shouldShowIntro({
      seen,
      fromSearch: fromSearchEngine(document.referrer),
      hasSession: hasSessionCookieHere(),
    });
    if (!show) return;
    // 이 기기에서 한 번만, 이번 방문의 환영 팝업과는 겹치지 않게 — 아래 두 줄은 바로 적어야 뒤에 오는 팝업의 효과가 본다.
    markIntroSeen();
    markWelcomeShown();
    void Promise.resolve().then(() => setOpen(true));
  }, []);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
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
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      tabIndex={-1}
      className="fixed inset-0 z-[60] overflow-y-auto bg-page outline-none"
    >
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-8 pt-4 [padding-top:max(1rem,env(safe-area-inset-top))] [padding-bottom:max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-semibold text-accent">내 여행 스케치</p>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-3 py-1.5 text-[14px] font-medium text-text-muted transition hover:bg-black/5 hover:text-text"
          >
            건너뛰기
          </button>
        </div>

        <div className="mt-4">
          <Scene photos={photos} />
        </div>

        <div className="mt-6 text-center">
          <h2 id="intro-title" className="text-[30px] font-bold leading-[1.25] tracking-tight text-text">
            사진만 고르면,{" "}
            <br />
            내 여행이 한 장이 돼요
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed text-text-muted">날짜와 장소로 저절로 정리해 드려요</p>
        </div>

        <ul aria-label="특징" className="mt-6 flex flex-col gap-2.5">
          {FEATURES.map((feature) => (
            <li key={feature.text} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-[15px] font-medium text-text ring-1 ring-line">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">{feature.icon}</span>
              {feature.text}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-3 pt-7">
          <AddPhotosLink
            href="/trips/new"
            onClick={close}
            className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-4 text-[17px] font-semibold text-on-accent shadow-[0_8px_20px_-8px_rgba(11,102,240,0.6)] transition hover:bg-accent-hover"
          >
            시작하기
          </AddPhotosLink>
          <Link
            href="/example"
            onClick={close}
            className="self-center text-[14px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text"
          >
            예시 여행 먼저 보기
          </Link>
          <p className="text-center text-[12px] text-text-faint">사진: 한국관광공사</p>
        </div>
      </div>
    </div>
  );
}
