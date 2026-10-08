"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { TripInView } from "@/lib/hub";
import { tripFocus } from "@/lib/scrollMemory";

/*
  시트를 살짝만 올린 처음 모습의 여행 카드 줄.

  예전에는 이 자리에 요약 · 달 막대 · 단추가 있어서 여행 목록은 시트를 끌어올려야 보였다. 내 여행 화면을 열었는데
  "내 여행들"이 안 보이는 것이다. 카드가 가로로 늘어서면 처음부터 보이고, 옆으로 밀어 넘긴다. 끌어올리면 같은 여행이
  세로 목록(TripsPanel)이 된다 — 그래서 이 줄은 살짝 올린 모습에서만 그린다.

  카드를 누르면 지도가 그 여행으로 날아가 길이 이어지고, 눌린 카드에 "열기"가 나타난다. 누르자마자 지도를 떠나 버리면
  지도로 고르는 맛이 없어서 고르는 것과 여는 것은 두 걸음이다 — 다만 여는 길이 눈에 보이게 한다. 지도를 옮기면 카드도
  따라 바뀐다(지금 지도에 보이는 여행만).
*/

interface TripCardsProps {
  trips: TripInView[];
  /** 지금 지도에 이어 놓은 여행. */
  focused: string | null;
  /** 원본 경로 → 핀 사진 주소. 카드마다 대표 사진으로 쓴다. */
  photoUrls: Map<string, string>;
  onFocus: (trip: TripInView) => void;
  onShowAll: () => void;
}

const day = (stamp: string) => stamp.replaceAll("-", ".");

export function TripCards({ trips, focused, photoUrls, onFocus, onShowAll }: TripCardsProps) {
  const row = useRef<HTMLUListElement>(null);
  const cardOf = useRef(new Map<string, HTMLLIElement>());

  /*
    고른 카드가 줄 밖에 있으면 밀어서 가운데로 가져온다. 상세에서 "← 내 여행"으로 돌아오면 그 여행이 이어진 채
    열리는데, 카드가 옆으로 밀려 안 보이면 무엇이 골라졌는지 알 수 없다.
  */
  useEffect(() => {
    if (!focused) return;
    const list = row.current;
    const card = cardOf.current.get(focused);
    if (!list || !card) return;
    const left = card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2;
    list.scrollTo?.({ left: Math.max(0, left), behavior: "smooth" });
  }, [focused]);

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 py-1">
        <p className="text-[14px] text-text-muted">이 화면에는 다녀온 곳이 없어요. 지도를 옮기거나 줄여 보세요.</p>
        <button
          type="button"
          onClick={onShowAll}
          className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
        >
          전체 보기
        </button>
      </div>
    );
  }

  return (
    <ul
      ref={row}
      aria-label="이 화면의 여행"
      // 옆으로 미는 줄이다. 시트를 끄는 손과 다투지 않게 끌기에서 뺀다(HubSheet 가 data-no-drag 를 본다).
      data-no-drag
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
    >
      {trips.map((trip) => {
        const on = trip.tripId === focused;
        const face = trip.places.find((place) => place.coverPath && photoUrls.get(place.coverPath));
        const photo = face?.coverPath ? photoUrls.get(face.coverPath) : undefined;
        return (
          <li
            key={trip.tripId}
            ref={(node) => {
              if (node) cardOf.current.set(trip.tripId, node);
              else cardOf.current.delete(trip.tripId);
            }}
            className="w-[116px] shrink-0"
          >
            <div className={`overflow-hidden rounded-xl bg-surface ${on ? "ring-2 ring-accent" : "ring-1 ring-line"}`}>
              <button type="button" onClick={() => onFocus(trip)} aria-pressed={on} className="block w-full text-left">
                <span className="block h-14 w-full overflow-hidden bg-bg-subtle">
                  {photo && (
                    // 서명 주소는 그때그때 바뀐다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="block truncate px-2 pt-1.5 text-[13px] font-semibold text-text">{trip.label}</span>
                {/* 고른 카드는 이 줄을 "열기"에게 내준다. 날짜는 화면 읽기 도구를 위해 남긴다. */}
                <span className={on ? "sr-only" : "flex h-7 items-center px-2 text-[11px] text-text-muted"}>
                  {day(trip.startedOn)}
                </span>
              </button>
              {on && (
                <Link
                  href={`/trips/${trip.tripId}`}
                  onClick={() => tripFocus.rememberFrom("/?v=sketch")}
                  className="flex h-7 items-center justify-center bg-accent-soft text-[12px] font-semibold text-accent transition hover:brightness-95"
                >
                  열기 ›
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
