"use client";

import Link from "next/link";
import type { TripInView } from "@/lib/hub";
import { tripFocus } from "@/lib/scrollMemory";

/*
  이 화면에 든 여행들.

  지도를 옮기면 목록이 따라 바뀐다. "강원도에 뭐가 있었지" 싶으면 지도를
  강원도로 옮기기만 하면 된다 — 따로 거를 것이 없다.

  한 줄을 누르면 그 여행을 지도에 잇고 그리로 날아간다. 상세로 가는 것은
  눌린 줄에 나타나는 "열기"다. 누르자마자 지도를 떠나 버리면 지도로 고르는
  맛이 없다. 모든 줄에 "열기"를 달아 두면 줄을 누르면 열리는 줄 알고 눌렀다가
  지도만 움직이는 데 놀란다 — 살짝 올린 모습의 여행 카드(TripCards)와 같은 규칙이다.
*/

interface TripsPanelProps {
  trips: TripInView[];
  /** 지금 지도에 이어 놓은 여행. */
  focused: string | null;
  /** 원본 경로 → 핀 사진 주소. 줄마다 대표 사진으로 쓴다. */
  photoUrls: Map<string, string>;
  onFocus: (trip: TripInView) => void;
  onShowAll: () => void;
}

const day = (stamp: string) => stamp.replaceAll("-", ".");

export function TripsPanel({ trips, focused, photoUrls, onFocus, onShowAll }: TripsPanelProps) {
  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 py-2">
        <p className="text-[14px] text-text-muted">
          이 화면에는 다녀온 곳이 없어요. 지도를 옮기거나 줄여 보세요.
        </p>
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
    <ol className="flex flex-col">
      {trips.map((trip) => {
        const on = trip.tripId === focused;
        const face = trip.places.find((place) => place.coverPath && photoUrls.get(place.coverPath));
        const photo = face?.coverPath ? photoUrls.get(face.coverPath) : undefined;
        return (
          <li key={trip.tripId} className="border-b border-line last:border-b-0">
            <div className={`-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 ${on ? "bg-accent-soft" : ""}`}>
              <button
                type="button"
                onClick={() => onFocus(trip)}
                aria-pressed={on}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                  {photo && (
                    // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[15px] font-semibold ${on ? "text-accent" : "text-text"}`}>
                    {trip.label}
                  </span>
                  <span className="block truncate text-[13px] text-text-muted">
                    {day(trip.startedOn)} · {trip.places.length}곳 · 사진 {trip.photoCount}장
                  </span>
                </span>
              </button>
              {on && (
                <Link
                  href={`/trips/${trip.tripId}`}
                  onClick={() => tripFocus.rememberFrom("/?v=sketch")}
                  className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-accent ring-1 ring-line transition hover:bg-accent-soft"
                >
                  열기
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
