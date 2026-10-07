"use client";

import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ADD_HREF,
  MAP_HREF,
  ME_HREF,
  SKETCH_HREF,
  SPOTS_HREF,
  activeNav,
  homeStart,
  showsBottomNav,
  type NavId,
} from "@/lib/nav";
import { readStart, rememberStart, type Start } from "@/lib/start";
import { canIn, useFamilyView } from "@/lib/familyView";

/*
  폰 하단 탭 — 내 여행 · 한장 · 사진 고르기 · 여행 100선 · 내 정보.

  폰에서는 위 띠가 좁아 갈래를 둘 이상 두기 어렵고(375px 에서는 갈래 둘과 계정 칩만으로
  폭이 꽉 찬다), 화면마다 "사진 고르기 · 한장 요약 · 여행 목록" 단추가 제각각 흩어져
  있었다. 엄지가 닿는 아래에 다섯 곳을 한 줄로 모은다(＋가 가운데). 맨 끝의 내 정보는 가족 공유·가족 책장·
  보관함 정리·로그아웃이 모인 곳이다 — 예전에는 위 띠의 이름 칩을 눌러야 했는데, 폰에서는 그 칩이 사진만
  남아 메뉴인 줄 알기 어려웠다. 넓은 화면(640px~)에는 위 띠가
  있어 이 탭은 없다.

  숨기는 화면은 lib/nav 의 showsBottomNav 가 정한다 — 한장 요약(저장 막대가 그 자리를
  쓴다), 링크로 받은 화면, 로그인 길.
*/

/** 이 아이콘들은 글자 옆에서 크기만 맞으면 된다. 색은 글자를 따른다. */
function Icon({ children }: { children: ReactNode }) {
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

const PIN = (
  <Icon>
    <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);
const FRAME = (
  <Icon>
    <rect x="4" y="5" width="16" height="14" rx="2.5" />
    <path d="M4 15.5l4.2-4.2 4 4 3-3L20 16" />
    <circle cx="9" cy="9.5" r="1.2" />
  </Icon>
);
const COMPASS = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" />
  </Icon>
);

const PERSON = (
  <Icon>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Icon>
);

interface Item {
  id: NavId | "add";
  label: string;
  href: string;
  icon: ReactNode;
  /** 누르면 다음에 첫 화면이 열릴 갈래로 기억한다. 위 띠의 갈래와 같은 동작이다. */
  remember?: "sketch" | "spots";
}

const ITEMS: Item[] = [
  { id: "trips", label: "내 여행", href: MAP_HREF, icon: PIN, remember: "sketch" },
  { id: "sketch", label: "한장", href: SKETCH_HREF, icon: FRAME },
  { id: "add", label: "사진 고르기", href: ADD_HREF, icon: null },
  { id: "spots", label: "여행 100선", href: SPOTS_HREF, icon: COMPASS, remember: "spots" },
  { id: "me", label: "내 정보", href: ME_HREF, icon: PERSON },
];

function Bar({ active }: { active: NavId | null }) {
  // 가족의 여행을 보는 동안에는 "사진 고르기"를 뺀다 — 남의 여행에 올리는 것으로 헷갈린다.
  const items = canIn(useFamilyView(), "add") ? ITEMS : ITEMS.filter((item) => item.id !== "add");
  return (
    <nav
      aria-label="하단 메뉴"
      /*
        위 띠(z-30)와 같은 층. 모달(z-40~50)은 이 위에 떠야 한다 — 아래에서 올라오는
        시트(HubDialog)가 탭에 잘리면 안 된다.
      */
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md sm:hidden [padding-bottom:env(safe-area-inset-bottom,0px)]"
    >
      <ul className={`mx-auto grid h-14 max-w-md ${items.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {items.map((item) => {
          const on = item.id !== "add" && item.id === active;
          return (
            <li key={item.id} className="min-w-0">
              <Link
                href={item.href}
                onClick={item.remember ? () => rememberStart(item.remember!) : undefined}
                aria-current={on ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition ${
                  on ? "font-semibold text-accent" : "font-medium text-text-muted"
                }`}
              >
                {item.id === "add" ? (
                  // 하는 일이라 다른 탭과 달리 색으로 눈에 띄게 한다. 켜지는 곳이 아니다.
                  <span
                    aria-hidden="true"
                    className="grid h-[26px] w-[26px] place-items-center rounded-full bg-accent text-[18px] font-normal leading-none text-on-accent"
                  >
                    +
                  </span>
                ) : (
                  item.icon
                )}
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const subscribeNever = () => () => undefined;

/**
 * 첫 화면에서 지금 열린 갈래를 따르는 탭. 주소(?v=)와 지난번에 고른 것(쿠키)이 정한다.
 *
 * 쿠키는 브라우저에만 있다. 서버가 그린 첫 그림은 모른다고 하고(아무것도 안 켠다), 붙은
 * 뒤에 맞춘다 — 처음부터 다르게 그리면 React 가 서버가 그린 것을 그대로 두어 켜진 곳이
 * 어긋난 채 남는다(BackToSketches 도 같은 까닭으로 같은 길을 쓴다).
 */
function Current({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const remembered = useSyncExternalStore<Start | "none" | "unknown">(
    subscribeNever,
    () => readStart() ?? "none",
    () => "unknown",
  );
  const start = pathname === "/" ? homeStart(params.get("v"), remembered === "none" ? null : remembered) : null;
  return <Bar active={activeNav(pathname, start)} />;
}

/** 글을 쓰는 칸에 손이 가 있는가. */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const writes = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.matches('input:not([type="checkbox"],[type="radio"],[type="button"],[type="submit"],[type="range"],[type="file"])') ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable);
    const onIn = (event: FocusEvent) => setTyping(writes(event.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}

export function BottomNav() {
  const pathname = usePathname();
  /*
    글을 쓰는 동안에는 숨는다. 고정된 탭은 키보드가 올라올 때 그 위로 떠올라 입력칸을
    가리곤 한다. 다른 칸으로 손이 옮겨 가면 focusout 다음에 focusin 이 곧바로 오므로
    깜빡임은 한 프레임이다.
  */
  const typing = useTyping();
  if (!showsBottomNav(pathname) || typing) return null;

  return (
    /*
      useSearchParams 는 정적으로 그려 두는 화면에서 경계가 있어야 한다. 경계 밖(서버가
      그린 첫 그림)에서는 켜진 곳 없이 탭만 그려 두고, 붙은 뒤에 켠다. 첫 화면이 아닌
      곳은 주소만으로 정해져 처음부터 맞다.
    */
    <Suspense fallback={<Bar active={activeNav(pathname, null)} />}>
      <Current pathname={pathname} />
    </Suspense>
  );
}

/**
 * 하단 탭이 덮는 만큼 내용 아래를 비워 둔다(폰에서만).
 *
 * 탭을 숨기는 화면은 그 높이를 0 으로 돌려준다. 그 안에서 높이를 재는 것(지도 허브)과
 * 아래 구석에 떠 있는 단추가 같은 값(--bottom-nav-h)을 보므로, 탭이 없는 화면에서
 * 그것들이 탭 자리를 비워 두지 않게 한다.
 */
export function BottomNavSpace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={showsBottomNav(pathname) ? "max-sm:pb-[var(--bottom-nav-h)]" : "[--bottom-nav-h:0px]"}>{children}</div>;
}
