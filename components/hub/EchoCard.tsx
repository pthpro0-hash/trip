"use client";

import type { HubPlace } from "@/lib/hub";
import { echoLabel, type Echo } from "@/lib/timeline";

/*
  몇 해 전 이맘때.

  사진을 새로 넣지 않아도 들어올 이유가 생긴다. 목록 맨 위에 한 장만
  띄운다 — 여러 장이면 광고가 되고, 한 장이면 기억이 된다.
*/

interface EchoCardProps {
  echo: Echo<HubPlace>;
  photo: string | undefined;
  onOpen: (place: HubPlace) => void;
}

export function EchoCard({ echo, photo, onOpen }: EchoCardProps) {
  const { place } = echo;
  return (
    <button
      type="button"
      onClick={() => onOpen(place)}
      className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-accent-soft p-3 text-left transition hover:brightness-[0.98]"
    >
      <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface">
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
          <img src={photo} alt="" className="h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-accent">{echoLabel(echo)}</span>
        <span className="block truncate text-[16px] font-bold tracking-tight text-text">{place.placeName}</span>
        <span className="block truncate text-[13px] text-text-muted">
          {place.startedAt.slice(0, 10).replaceAll("-", ".")} · {place.tripLabel}
        </span>
      </span>
    </button>
  );
}
