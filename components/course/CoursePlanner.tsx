"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { getSpotThumbnail } from "@/lib/media";
import { useTripPlan, useWishlist } from "@/lib/collections";
import { useMyLocation } from "@/lib/useMyLocation";
import { formatDistance, legDistancesKm, orderByProximity, totalDistanceKm } from "@/lib/geo";
import { NearbyButton } from "@/components/filter/NearbyButton";
import { CourseMap } from "./CourseMap";

const SPOTS = spotsData as Spot[];
const BY_ID = new Map(SPOTS.map((spot) => [spot.id, spot]));

// 구글지도 URL API가 받아 주는 경유지 수. 넘어가면 앞쪽만 열리므로,
// 조용히 잘라내지 말고 화면에 알려 준다.
const GOOGLE_WAYPOINT_LIMIT = 9;

function googleDirectionsUrl(spots: Spot[]) {
  if (spots.length < 2) return null;
  const origin = spots[0];
  const destination = spots[spots.length - 1];
  const waypoints = spots.slice(1, -1).slice(0, GOOGLE_WAYPOINT_LIMIT);

  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.map((spot) => `${spot.lat},${spot.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params}`;
}

function kakaoDirectionsUrl(spot: Spot) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(spot.name)},${spot.lat},${spot.lng}`;
}

export function CoursePlanner() {
  const trip = useTripPlan();
  const wishlist = useWishlist();
  const { state: location, request: requestLocation, clear: clearLocation } = useMyLocation();
  const [confirmingClear, setConfirmingClear] = useState(false);

  // 데이터가 바뀌어 사라진 곳이 저장되어 있을 수 있다. 조용히 걸러낸다.
  const spots = useMemo(
    () => trip.ids.map((id) => BY_ID.get(id)).filter((spot): spot is Spot => Boolean(spot)),
    [trip.ids],
  );

  // 가고 싶다고 담아뒀지만 이번 여행에는 아직 안 넣은 곳들.
  const notYetAdded = useMemo(
    () =>
      wishlist.ids
        .filter((id) => !trip.ids.includes(id))
        .map((id) => BY_ID.get(id))
        .filter((spot): spot is Spot => Boolean(spot)),
    [wishlist.ids, trip.ids],
  );

  const legs = useMemo(() => legDistancesKm(spots), [spots]);
  const total = useMemo(() => totalDistanceKm(spots), [spots]);
  const googleUrl = googleDirectionsUrl(spots);
  const truncated = Math.max(0, spots.length - 2 - GOOGLE_WAYPOINT_LIMIT);

  const sortByProximity = () => {
    const start = location.status === "ready" ? location.point : undefined;
    trip.reorder(orderByProximity(spots, start).map((spot) => spot.id));
  };

  if (spots.length === 0) {
    return (
      <>
        <div className="rounded-2xl bg-bg-subtle p-8 text-center">
          <p className="text-[17px] font-medium text-text">이번 여행에 담은 곳이 없어요</p>
          <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
            {notYetAdded.length > 0
              ? "가고 싶은 곳에서 골라 담아보세요."
              : "마음에 드는 곳의 하트를 누르면 가고 싶은 곳에 모입니다."}
          </p>
          {notYetAdded.length === 0 && (
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
            >
              여행지 둘러보기
            </Link>
          )}
        </div>
        <WishlistPicker spots={notYetAdded} onAdd={trip.add} />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <p className="text-[15px] text-text-muted">
          {spots.length}곳
          {spots.length > 1 && (
            <>
              {" · 총 "}
              <span className="font-medium text-text">{formatDistance(total)}</span>
              <span className="text-text-faint"> (직선거리 기준)</span>
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <NearbyButton state={location} onRequest={requestLocation} onClear={clearLocation} />
          {spots.length > 2 && (
            <button
              type="button"
              onClick={sortByProximity}
              className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
            >
              {location.status === "ready" ? "내 위치에서 가까운 순" : "가까운 순으로 정렬"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirmingClear) {
                trip.clear();
                setConfirmingClear(false);
              } else {
                setConfirmingClear(true);
              }
            }}
            onBlur={() => setConfirmingClear(false)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
              confirmingClear
                ? "bg-[#d70015] text-white"
                : "bg-bg-subtle text-text-muted hover:bg-line"
            }`}
          >
            {confirmingClear ? "정말 비울까요?" : "이번 여행 비우기"}
          </button>
        </div>
      </div>

      <div className="h-[340px] overflow-hidden rounded-2xl ring-1 ring-line">
        <CourseMap spots={spots} />
      </div>

      <ol className="flex flex-col gap-3">
        {spots.map((spot, index) => {
          const thumbnail = getSpotThumbnail(spot.id);
          return (
            <li key={spot.id} className="flex flex-col gap-2">
              {index > 0 && (
                <p className="pl-3 text-[12px] text-text-faint">
                  ↓ 이전 곳에서 {formatDistance(legs[index - 1])}
                </p>
              )}
              <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-on-accent">
                  {index + 1}
                </span>

                <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-subtle">
                  {thumbnail && (
                    <Image src={thumbnail} alt="" fill sizes="80px" className="object-cover" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/spots/${spot.id}`}
                    className="block truncate text-[15px] font-semibold tracking-tight text-text hover:text-accent"
                  >
                    {spot.name}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-text-faint">{spot.region}</p>
                  <a
                    href={kakaoDirectionsUrl(spot)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block text-[12px] font-medium text-accent hover:text-accent-hover"
                  >
                    길찾기 →
                  </a>
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <div className="flex gap-1">
                    <IconButton
                      label={`${spot.name} 위로`}
                      disabled={index === 0}
                      onClick={() => trip.move(index, index - 1)}
                    >
                      ↑
                    </IconButton>
                    <IconButton
                      label={`${spot.name} 아래로`}
                      disabled={index === spots.length - 1}
                      onClick={() => trip.move(index, index + 1)}
                    >
                      ↓
                    </IconButton>
                  </div>
                  <IconButton
                    label={`${spot.name} 코스에서 빼기`}
                    onClick={() => trip.remove(spot.id)}
                  >
                    빼기
                  </IconButton>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <WishlistPicker spots={notYetAdded} onAdd={trip.add} />

      {googleUrl && (
        <div className="flex flex-col gap-2">
          <a
            href={googleUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            구글지도로 전체 경로 열기
          </a>
          {truncated > 0 && (
            <p className="text-[12px] text-text-faint">
              구글지도는 경유지를 {GOOGLE_WAYPOINT_LIMIT}곳까지만 받아, 뒤쪽 {truncated}곳은 빠집니다.
            </p>
          )}
        </div>
      )}
    </>
  );
}

/*
  가고 싶은 곳과 이번 여행은 다른 서랍이다. 여기서 담아도 가고 싶은 곳에는
  그대로 남고, 이번 여행에서 빼도 가고 싶은 곳은 풀리지 않는다.
*/
function WishlistPicker({ spots, onAdd }: { spots: Spot[]; onAdd: (id: string) => void }) {
  if (spots.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-text">
        가고 싶은 곳에서 담기
      </h2>
      <div className="flex flex-wrap gap-2">
        {spots.map((spot) => (
          <button
            key={spot.id}
            type="button"
            onClick={() => onAdd(spot.id)}
            aria-label={`${spot.name} 이번 여행에 담기`}
            className="inline-flex items-center gap-1.5 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
          >
            <span aria-hidden="true" className="text-accent">+</span>
            {spot.name}
          </button>
        ))}
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-lg bg-bg-subtle px-2 py-1 text-[12px] font-medium text-text-muted transition hover:bg-line disabled:opacity-35 disabled:hover:bg-bg-subtle"
    >
      {children}
    </button>
  );
}
