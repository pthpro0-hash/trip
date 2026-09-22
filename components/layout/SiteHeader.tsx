"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountChip } from "@/components/auth/AccountChip";

/*
  이 서비스는 두 몸이다 — 어디를 갈지 고르는 쪽과, 다녀온 길을 남기는 쪽.

  둘을 한 화면에 섞어 놓으면 둘 다 흐려진다. 그렇다고 첫 화면을 두 개짜리
  관문으로 만들 수도 없다: 검색엔진이 보는 것이 100선 목록이고, 처음 온
  사람에게 "내 스케치"는 문이 아니라 빈 벽이기 때문이다.

  그래서 나누는 일은 여기서 한다. 어느 쪽이 커 보일지는 첫 화면이
  그 사람의 형편을 보고 정한다(HomeIntro 참고).
*/

const TABS = [
  { href: "/", label: "둘러보기" },
  { href: "/trips", label: "내 스케치" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  /** 하위 경로에 있어도 그 갈래가 켜져 보이게 한다. */
  const isOn = (href: string) => {
    if (href === "/") return pathname === "/" || pathname.startsWith("/spots") || pathname.startsWith("/regions");
    return pathname.startsWith(href) || pathname.startsWith("/sketch");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-1.5 truncate whitespace-nowrap text-[15px] font-semibold tracking-tight text-text transition hover:text-accent"
        >
          {/*
            좁은 화면에서는 이름을 접고 나침반만 남긴다. 375px 에서는
            갈래 둘과 계정 칩만으로 폭이 꽉 차, 이름을 두면 "여행." 으로
            잘린다. 잘린 이름보다 기호 하나가 낫다.
          */}
          <span aria-hidden="true">🧭</span>
          <span className="hidden sm:inline">나만의 여행 스케치</span>
          <span className="sr-only sm:hidden">나만의 여행 스케치</span>
        </Link>

        <nav aria-label="주요 메뉴" className="flex items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isOn(tab.href) ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[14px] font-medium transition ${
                isOn(tab.href)
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-bg-subtle hover:text-text"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto shrink-0">
          <AccountChip />
        </div>
      </div>
    </header>
  );
}
