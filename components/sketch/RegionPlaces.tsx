"use client";

import Link from "next/link";
import { CourseMap } from "@/components/course/CourseMap";
import type { SketchDot } from "@/lib/sketch";
import type { Region } from "@/lib/types";

/*
  권역을 고르면 그 안에서 다녀온 곳을 펼쳐 본다.

  카드 한 장은 "어떤 해였나"를 말하지만, 권역을 고른 사람은 다른 것을
  묻고 있다 — "강원에서 내가 어디어디 갔더라". 그건 이름이 붙은 목록으로만
  답할 수 있다. 100선 권역 화면이 쓰는 지도를 그대로 쓴다.

  선은 긋지 않는다. 서로 다른 날 따로 간 곳들이라, 이으면 있지도 않은
  동선이 그려진다.
*/

interface RegionPlacesProps {
  region: Region;
  dots: SketchDot[];
}

function shortDate(startedOn: string) {
  const [year, month, day] = startedOn.split("-");
  return `${year}. ${Number(month)}. ${Number(day)}.`;
}

export function RegionPlaces({ region, dots }: RegionPlacesProps) {
  // 최근에 간 곳부터. 지도의 번호와 목록의 번호가 같은 차례를 따른다.
  const places = [...dots]
    .filter((dot) => Number.isFinite(dot.lat) && Number.isFinite(dot.lng))
    .sort((a, b) => b.lastVisitedOn.localeCompare(a.lastVisitedOn));

  if (places.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="text-[13px] text-text-faint">{places.length}곳</p>
        <h2 className="text-[26px] font-bold tracking-tight text-text">{region}에서</h2>
      </div>

      <div className="h-[340px] overflow-hidden rounded-2xl ring-1 ring-line">
        <CourseMap
          spots={places.map((place) => ({
            lat: place.lat,
            lng: place.lng,
            name: place.placeName,
          }))}
          connect={false}
        />
      </div>

      <ol className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {places.map((place, index) => (
          <li key={`${place.lat},${place.lng}`}>
            <Link
              href={`/trips/${place.tripId}`}
              className="flex items-baseline gap-2 rounded-lg px-1 py-1 transition hover:bg-bg-subtle"
            >
              {/* 지도 위 번호와 그대로 이어 읽히게 한다. */}
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-on-accent">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">
                {place.placeName || "이름 없는 곳"}
              </span>
              <span className="shrink-0 text-[13px] text-text-faint">
                {shortDate(place.lastVisitedOn)} · 사진 {place.photoCount}장
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
