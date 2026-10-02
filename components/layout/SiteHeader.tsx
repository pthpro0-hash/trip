"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { AccountChip } from "@/components/auth/AccountChip";
import { rememberStart, type Start } from "@/lib/start";
import { canIn, useFamilyView } from "@/lib/familyView";
import { isReceiverPath } from "@/lib/nav";
import { ADD_HREF, MAP_HREF, SKETCH_HREF, SPOTS_HREF, activeNav, type NavId } from "@/lib/nav";

/*
  이 서비스는 두 몸이다 — 어디를 갈지 고르는 쪽과, 다녀온 길을 남기는 쪽.

  둘을 한 화면에 섞어 놓으면 둘 다 흐려진다. 그렇다고 첫 화면을 두 개짜리
  관문으로 만들 수도 없다: 검색엔진이 보는 것이 100선 목록이고, 처음 온
  사람에게 "내 여행"은 문이 아니라 빈 벽이기 때문이다.

  그래서 나누는 일은 여기서 한다. 어느 쪽이 커 보일지는 첫 화면이
  그 사람의 형편을 보고 정한다(HomeIntro 참고).

  갈래는 셋이다 — 내 여행(지도·목록), 한장(해마다 한 장), 여행 100선. 한장 요약이
  자리를 얻은 것은 이 서비스가 보여 주려는 결과이기 때문이다.

  위 띠의 갈래는 어느 화면에서든, 폰에서도 늘 보인다(첫 화면 포함). 길을 잃으면
  맨 위를 보면 된다. 폰의 하단 탭(BottomNav)은 엄지가 닿는 두 번째 길이다.
*/

const TABS: { id: NavId; label: string; href: string; start?: Start }[] = [
  { id: "trips", label: "내 여행", href: MAP_HREF, start: "sketch" },
  { id: "sketch", label: "한장", href: SKETCH_HREF },
  { id: "spots", label: "여행 100선", href: SPOTS_HREF, start: "spots" },
];

export function SiteHeader() {
  const pathname = usePathname();

  /** 하위 경로에 있어도 그 갈래가 켜져 보이게 한다. 첫 화면은 어느 갈래인지 주소만으로 몰라 켜지 않는다. */
  const active = activeNav(pathname, null);
  // 가족의 여행을 보는 동안에는 내 사진을 더하는 단추를 내지 않는다(남의 여행에 올리는 것으로 헷갈린다).
  const canAdd = canIn(useFamilyView(), "add");

  // 가족 우편함의 받는 쪽(부모님)에는 위 띠가 없다 — 엽서와 답장 단추뿐이다.
  if (isReceiverPath(pathname)) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      {/* 높이를 못 박는다. 지도 첫 화면이 "화면 − 이 띠" 만큼을 채운다. */}
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-5">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-1.5 truncate whitespace-nowrap text-[15px] font-semibold tracking-tight text-text transition hover:text-accent"
        >
          {/*
            좁은 화면에서는 이름을 접고 로고만 남긴다. 375px 에서는
            갈래 둘과 계정 칩만으로 폭이 꽉 차, 이름을 두면 "여행." 으로
            잘린다. 잘린 이름보다 기호 하나가 낫다.
          */}
          <Logo className="h-6 w-6 shrink-0" />
          <span className="hidden sm:inline">내 여행 스케치</span>
          <span className="sr-only sm:hidden">내 여행 스케치</span>
        </Link>

        <nav aria-label="주요 메뉴" className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                onClick={tab.start ? () => rememberStart(tab.start!) : undefined}
                aria-current={active === tab.id ? "page" : undefined}
                /*
                  한장은 폰의 위 띠에서 늘 접는다. 하단 탭이 없는 화면(한장 요약)에서도
                  375px 에는 갈래 셋과 계정 칩이 함께 들어가지 않고, 그 화면이 곧 한장이다.
                */
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] font-medium transition ${
                  tab.id === "sketch" ? "max-sm:hidden" : ""
                } ${active === tab.id ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-bg-subtle hover:text-text"}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/*
            사진을 넣는 것은 이 서비스의 가장 큰 일이라 어느 화면에서든 같은 자리에 있다.
            폰에서는 하단 탭의 가운데 단추가 그 일을 한다.
          */}
          {canAdd && (
            <Link
              href={ADD_HREF}
              className="hidden shrink-0 items-center rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-on-accent transition hover:bg-accent-hover sm:inline-flex"
            >
              + 사진 고르기
            </Link>
          )}
          {/*
            좁은 화면에서는 물음표만 남긴다. 375px 에서는 갈래 둘과 계정
            칩만으로도 폭이 빠듯해, 글자를 두면 계정 칩이 밀려 나간다.
          */}
          <Link
            href="/help"
            aria-label="도움말"
            aria-current={pathname.startsWith("/help") ? "page" : undefined}
            className={`grid h-8 shrink-0 place-items-center rounded-full px-2.5 text-[14px] font-medium transition sm:px-3.5 ${
              pathname.startsWith("/help")
                ? "bg-accent-soft text-accent"
                : "text-text-muted hover:bg-bg-subtle hover:text-text"
            }`}
          >
            <span aria-hidden="true" className="sm:hidden">
              ?
            </span>
            <span aria-hidden="true" className="hidden whitespace-nowrap sm:inline">
              도움말
            </span>
          </Link>
          <AccountChip />
        </div>
      </div>
    </header>
  );
}
