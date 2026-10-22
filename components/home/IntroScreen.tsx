"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { INTRO_BOOT_SCRIPT, closeIntro, introOpen, subscribeIntro } from "@/lib/intro";

/*
  로그인 전 사람에게 방문마다 한 번 뜨는 전체 화면 소개. 2초 남짓한 장면 — 사진 → 지도 위의 길과 핀 → 한 장 카드 — 이 차례로 나타난 뒤
  멈춘다. 동영상 파일이 아니라 화면에서 그려서(CSS) 가볍고, 어떤 화면에서도 또렷하다. 움직임을 줄인 기기에서는 마지막 그림이
  처음부터 보인다.

  언제 뜨는지는 lib/intro 가 정한다: 로그인 전이면 방문마다 한 번(같은 방문에서 앱 안으로 돌아올 때는 안 뜬다). 빨리 뜨도록 서버가
  처음부터 그려 보내고, 바로 앞의 작은 글이 그려지기 전에 볼지 말지를 정한다(lib/intro 의 INTRO_BOOT_SCRIPT). 닫으면 그 뒤의
  여행 100선이 그대로 보인다.
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
    text: "멋진 사진첩이 됩니다.",
    icon: (
      <Glyph>
        <rect x="4" y="5" width="16" height="14" rx="2.5" />
        <path d="M4 15.5l4.2-4.2 4 4 3-3L20 16" />
        <circle cx="9" cy="9.5" r="1.2" />
      </Glyph>
    ),
  },
  {
    text: "여행이 지도 위에 그려져요.",
    icon: (
      <Glyph>
        <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </Glyph>
    ),
  },
  {
    text: "지인 공유, 가족 사진첩도 됩니다.",
    icon: (
      <Glyph>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </Glyph>
    ),
  },
];

/*
  반복해서 움직이는 장면(약 8초): 사진 석 장이 겹쳐 놓이고 → 지도 위 제 자리로 날아가 핀이 되고(사진이 곧 핀이다) → 길이 그려지고 →
  "속초 외 2곳 · 1박 2일 · 사진 6장" 카드가 올라온다. 위의 작은 알약이 지금 어느 걸음인지 말해 준다. 장식이라 스크린리더에는 읽히지 않는다.
  크기는 모두 장면 상자 기준(cqw)이라 화면 높이에 맞춰 커지고 줄어든다. 움직임을 줄인 기기에서는 완성된 그림만 보인다(globals.css).
*/
const PINS = [
  { x: 38, y: 58, sx: 2, sy: -8, sr: -9, d: 0 },
  { x: 60, y: 44, sx: -10, sy: 2, sr: 4, d: 0.2 },
  { x: 50, y: 27, sx: 10, sy: 25, sr: 11, d: 0.4 },
];

function Scene({ photos }: { photos: string[] }) {
  return (
    <div aria-hidden="true" className="intro-stage relative mx-auto h-full max-w-full aspect-square">
      <div className="intro-map absolute inset-0 overflow-hidden rounded-[8cqw] bg-surface shadow-[0_10px_30px_-12px_rgba(20,40,80,0.35)] ring-1 ring-line">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <rect width="100" height="100" className="fill-accent-soft" />
          <path
            d="M38 6 L52 8 L60 16 L58 24 L66 32 L64 44 L70 54 L66 66 L58 78 L48 88 L40 92 L34 86 L36 76 L30 66 L34 54 L30 44 L36 34 L34 22Z"
            className="fill-bg-subtle stroke-line"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <path
            d="M38 58 C48 58 55 52 60 44 C63 38 56 33 50 27"
            pathLength={1}
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="intro-route stroke-accent"
          />
        </svg>
      </div>

      <p className="absolute left-1/2 top-[4cqw] z-10 grid -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/90 px-[3.5cqw] py-[1.4cqw] text-[3.8cqw] font-semibold text-text shadow ring-1 ring-line">
        <span className="intro-cap intro-cap-1 col-start-1 row-start-1">사진을 올리면</span>
        <span className="intro-cap intro-cap-2 col-start-1 row-start-1">날짜와 장소로 묶여서</span>
        <span className="intro-cap intro-cap-3 col-start-1 row-start-1">지도 위 한 장이 돼요</span>
      </p>

      {PINS.slice(0, photos.length).map((pin, index) => (
        <div
          key={photos[index]}
          className="intro-photo absolute z-10 aspect-square w-[20cqw] overflow-hidden rounded-full bg-bg-subtle shadow-lg ring-[0.8cqw] ring-surface"
          style={{
            left: `${pin.x}%`,
            top: `${pin.y}%`,
            ["--sx" as string]: `${pin.sx}cqw`,
            ["--sy" as string]: `${pin.sy}cqw`,
            ["--sr" as string]: `${pin.sr}deg`,
            ["--d" as string]: `${pin.d}s`,
          }}
        >
          <Image src={photos[index]} alt="" fill sizes="80px" className="object-cover" priority />
        </div>
      ))}

      <div className="intro-card absolute inset-x-[6cqw] bottom-[4cqw] z-10 flex items-center gap-[3cqw] rounded-[5cqw] bg-surface px-[4cqw] py-[2.6cqw] shadow-[0_8px_24px_-8px_rgba(20,40,80,0.4)] ring-1 ring-line">
        <span className="grid h-[9cqw] w-[9cqw] shrink-0 place-items-center rounded-full bg-accent text-[4.6cqw] text-on-accent">
          ✓
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[4.4cqw] font-bold text-text">속초 외 2곳</span>
          <span className="block truncate text-[3.4cqw] text-text-muted">1박 2일 · 사진 6장</span>
        </span>
      </div>
    </div>
  );
}

export function IntroScreen({ photos }: { photos: string[] }) {
  // 서버는 늘 그린다(보일지는 앞의 글과 globals.css 가 정한다). 붙은 뒤에는 브라우저의 판단을 따른다.
  const open = useSyncExternalStore(subscribeIntro, introOpen, () => true);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = closeIntro;

  useEffect(() => {
    if (!open) return;
    const kept = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeIntro();
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = kept;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  /*
    폰에서는 스크롤 없이 한 화면에 들어와야 한다. 높이를 dvh(주소창·아래 막대를 뺀 실제로 보이는 높이)로 잡고, 장면이 남는
    높이를 모두 쓴다 — 화면이 낮으면 장면이 줄고, 글자 크기도 높이를 따라 줄어든다. 아주 낮은 화면(가로로 눕힌 폰 등)에서는
    특징 줄을 접고, 그래도 모자라면 그때만 스크롤된다.
  */
  return (
    <>
    {/* 이 글이 소개보다 먼저 읽혀야 그려지기 전에 감출 수 있다. 앱 안에서 그려질 때(React 가 넣을 때)는 돌지 않는다 — 그때는 introOpen 이 정한다. */}
    <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      tabIndex={-1}
      className="intro-overlay fixed inset-0 z-[60] overflow-y-auto bg-page outline-none"
    >
      <div className="mx-auto flex h-dvh min-h-[420px] w-full max-w-md flex-col gap-[1.4dvh] px-6 pb-3 pt-2 [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] [padding-top:max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex shrink-0 items-center justify-between">
          <p className="text-[14px] font-semibold text-accent">내 여행 스케치</p>
          <button
            type="button"
            onClick={close}
            className="rounded-full px-3 py-1.5 text-[14px] font-medium text-text-muted transition hover:bg-black/5 hover:text-text"
          >
            건너뛰기
          </button>
        </div>

        <div className="relative min-h-[120px] max-h-[340px] flex-1">
          <Scene photos={photos} />
        </div>

        <div className="shrink-0 text-center">
          <h2 id="intro-title" className="text-[clamp(21px,3.7dvh,28px)] font-bold leading-[1.28] tracking-tight text-text">
            귀찮은 사진 정리.{" "}
            <br />
            올리기만 하면,{" "}
            <br />내 여행 스케치가 됩니다.
          </h2>
          <p className="mt-[0.8dvh] text-[clamp(13px,2.1dvh,16px)] leading-snug text-text-muted">날짜와 장소로 저절로 정리해 드려요</p>
        </div>

        <ul aria-label="특징" className="flex shrink-0 flex-col gap-[0.9dvh] [@media(max-height:560px)]:hidden">
          {FEATURES.map((feature) => (
            <li
              key={feature.text}
              className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-[0.9dvh] text-[clamp(13px,2.1dvh,15px)] font-medium text-text ring-1 ring-line"
            >
              <span className="grid h-[clamp(26px,4.2dvh,36px)] w-[clamp(26px,4.2dvh,36px)] shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                {feature.icon}
              </span>
              {feature.text}
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 flex-col items-center gap-[0.9dvh]">
          <button
            type="button"
            onClick={close}
            className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-[clamp(12px,2.2dvh,16px)] text-[17px] font-semibold text-on-accent shadow-[0_8px_20px_-8px_rgba(11,102,240,0.6)] transition hover:bg-accent-hover"
          >
            시작하기
          </button>
          <Link
            href="/example"
            onClick={close}
            className="text-[14px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text"
          >
            예시 여행 먼저 보기
          </Link>
          <p className="text-center text-[11px] text-text-faint">사진: 한국관광공사</p>
        </div>
      </div>
    </div>
    </>
  );
}
