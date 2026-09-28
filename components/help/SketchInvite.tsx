"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { countTrips } from "@/lib/supabase/trips";
import { hasSeen } from "@/lib/seen";
import { inviteState, markInvited, shouldInvite, snoozeInviteToday, type InviteSpot } from "@/lib/invite";
import { HELP_CLOSED } from "./FirstVisitHelp";

/*
  내 스케치로 부르는 한 장.

  자료가 하나도 없는 사람에게만 내민다 — 로그인 전이거나, 로그인했지만
  여행을 하나도 기록하지 않은 사람. 이미 쓰고 있는 사람에게 "써 보세요"는
  방해다. 언제 내밀지는 lib/invite 가 정한다.

  하고 싶은 말은 하나다: 사진 수백 장을 올리면 이것들이 저절로 된다.
  무엇이 되는지를 목록으로 보여 주고, 버튼 하나로 시작하게 한다.
*/

const POINTS: { icon: string; text: string }[] = [
  { icon: "📅", text: "찍은 날짜와 장소대로 여행이 저절로 묶여요" },
  { icon: "🗺️", text: "다녀온 곳이 지도 위에 그때 사진으로 얹혀요" },
  { icon: "🧭", text: "들른 순서대로 길이 그려지고, 다시 걸어 볼 수 있어요" },
  { icon: "🖼️", text: "한 해가 '한장 요약' 카드 한 장으로 — 저장도 공유도" },
  { icon: "📍", text: "밟은 시도가 칠해지고, 몇 해 전 이맘때가 떠올라요" },
];

type Who = "guest" | "empty";

export function SketchInvite({ spot }: { spot: InviteSpot }) {
  const [who, setWho] = useState<Who | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    // 로그인을 쓸 수 없는 곳이면 부를 곳도 없다.
    if (!supabase) return;
    let active = true;

    const decide = async () => {
      if (!shouldInvite(inviteState(spot, hasSeen("help")))) return;
      try {
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        if (!data.user) {
          setWho("guest");
        } else {
          // 몇 개인지 모르면 내밀지 않는다. 쓰는 사람을 귀찮게 하는 쪽이 더 나쁘다.
          const count = await countTrips(supabase, data.user.id);
          if (!active || count !== 0) return;
          setWho("empty");
        }
        markInvited(spot);
      } catch {
        // 못 물어봤으면 조용히 넘어간다.
      }
    };

    void decide();
    // 사용법 창이 떠 있으면 닫힌 뒤에 다시 따진다.
    window.addEventListener(HELP_CLOSED, decide);
    return () => {
      active = false;
      window.removeEventListener(HELP_CLOSED, decide);
    };
  }, [spot]);

  const close = useCallback(() => setWho(null), []);

  useEffect(() => {
    if (!who) return;
    const kept = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = kept;
      window.removeEventListener("keydown", onKey);
    };
  }, [who, close]);

  if (!who) return null;

  const start =
    who === "guest"
      ? { href: "/login?next=%2Ftrips%2Fnew", label: "로그인하고 시작하기" }
      : { href: "/trips/new", label: "사진 올리러 가기" };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="내 스케치 안내"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-line"
      >
        <button
          type="button"
          onClick={close}
          aria-label="닫기"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-bg-subtle text-[16px] text-text-muted transition hover:bg-line hover:text-text"
        >
          <span aria-hidden="true">✕</span>
        </button>

        <div className="flex flex-col gap-4 px-6 pb-5 pt-6">
          <div className="pr-8">
            <p className="text-[13px] font-semibold text-accent">내 스케치</p>
            <h2 className="mt-1 text-[22px] font-bold leading-snug tracking-tight text-text">
              여행 사진 수백 장, 올리기만 하세요
            </h2>
            <p className="mt-1.5 text-[15px] text-text-muted">나머지는 저절로 이렇게 돼요.</p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {POINTS.map((point) => (
              <li key={point.text} className="flex items-start gap-3 text-[15px] leading-snug text-text">
                <span aria-hidden="true" className="text-[18px] leading-none">
                  {point.icon}
                </span>
                <span>{point.text}</span>
              </li>
            ))}
          </ul>

          <p className="rounded-xl bg-accent-soft px-4 py-3 text-center text-[16px] font-bold text-accent">
            {who === "guest" ? "로그인하고 사진만 올리면 끝!" : "사진만 올리면 끝!"}
          </p>

          <Link
            href={start.href}
            onClick={close}
            className="rounded-full bg-accent px-5 py-3 text-center text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover"
          >
            {start.label}
          </Link>

          <div className="flex items-center justify-between text-[13px]">
            <button
              type="button"
              onClick={() => {
                snoozeInviteToday();
                close();
              }}
              className="text-text-faint underline-offset-2 hover:text-text hover:underline"
            >
              오늘 그만 보기
            </button>
            <button type="button" onClick={close} className="font-medium text-text-muted hover:text-text">
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
