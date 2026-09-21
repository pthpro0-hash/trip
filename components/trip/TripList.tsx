"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { deleteTrip, fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { companionLabel } from "@/lib/korean";
import { signedUrls } from "@/lib/supabase/photos";

type Status = "loading" | "guest" | "ready" | "failed";

function formatSpan(startedOn: string, endedOn: string) {
  // "09월 13일"보다 "9월 13일"이 사람이 쓰는 말에 가깝다.
  const short = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}월 ${Number(day)}일`;
  };
  const year = startedOn.slice(0, 4);
  if (startedOn === endedOn) return `${year}년 ${short(startedOn)}`;
  return `${year}년 ${short(startedOn)} ~ ${short(endedOn)}`;
}

export function TripList() {
  // 로그인 설정이 아예 없으면 기다릴 것도 없다. 효과 안에서 setState 하지
  // 않도록 처음 값으로 정한다.
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  // 지우는 일은 되돌릴 수 없다. 한 번 물어보고 나서 지운다.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // 보관함이 비공개라 고정 주소가 없다. 볼 때마다 짧게 사는 주소를 받는다.
  const [covers, setCovers] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setStatus("guest");
        return;
      }
      setUserId(data.user.id);
      const rows = await fetchTrips(supabase, data.user.id);
      if (!active) return;
      if (!rows) {
        setStatus("failed");
        return;
      }
      setTrips(rows);
      setStatus("ready");

      const paths = rows.map((trip) => trip.coverPath).filter((path): path is string => !!path);
      if (paths.length > 0) {
        const urls = await signedUrls(supabase, paths);
        if (active) setCovers(urls);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const remove = async (tripId: string) => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;

    setRemoving(tripId);
    setFailed(false);
    const ok = await deleteTrip(supabase, userId, tripId);
    if (ok) setTrips((current) => current.filter((trip) => trip.id !== tripId));
    else setFailed(true);
    setRemoving(null);
    setConfirming(null);
  };

  if (status === "loading") {
    return <p className="text-[15px] text-text-faint">불러오는 중…</p>;
  }

  if (status === "guest") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">
          여행 기록은 계정에 저장돼요. 로그인하시면 어느 기기에서나 이어 보실 수 있어요.
        </p>
        <Link
          href="/login?next=%2Ftrips"
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[15px] text-text-muted">
        기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6 text-center">
        <p className="text-[17px] font-medium text-text">아직 기록한 여행이 없어요</p>
        <p className="text-[15px] leading-relaxed text-text-muted">
          사진을 고르면 언제 어디를 다녀왔는지 찾아 드려요.
        </p>
        <Link
          href="/trips/new"
          className="self-center rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          사진에서 찾기
        </Link>
      </div>
    );
  }

  const totalVisits = trips.reduce((sum, trip) => sum + trip.visits.length, 0);
  const totalPhotos = trips.reduce(
    (sum, trip) => sum + trip.visits.reduce((count, visit) => count + visit.photoCount, 0),
    0,
  );

  return (
    <>
      <p className="text-[13px] text-text-faint">
        여행 {trips.length}건 · 다녀온 곳 {totalVisits}곳 · 사진 {totalPhotos}장
      </p>

      {failed && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          지우지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      <ol className="flex flex-col gap-4">
        {trips.map((trip) => (
          <li key={trip.id} className="flex flex-col gap-2.5 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[17px] font-semibold tracking-tight text-text">
                  {formatSpan(trip.startedOn, trip.endedOn)}
                </p>
                {trip.companions && (
                  <p className="mt-0.5 text-[13px] text-text-muted">
                    {companionLabel(trip.companions)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => (confirming === trip.id ? remove(trip.id) : setConfirming(trip.id))}
                onBlur={() => setConfirming((current) => (current === trip.id ? null : current))}
                disabled={removing === trip.id}
                aria-label={
                  confirming === trip.id
                    ? `${formatSpan(trip.startedOn, trip.endedOn)} 기록 정말 지우기`
                    : `${formatSpan(trip.startedOn, trip.endedOn)} 기록 지우기`
                }
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-60 ${
                  confirming === trip.id
                    ? "bg-[#d70015] text-white"
                    : "bg-bg-subtle text-text-muted hover:bg-line"
                }`}
              >
                {removing === trip.id
                  ? "지우는 중…"
                  : confirming === trip.id
                    ? "정말 지울까요?"
                    : "지우기"}
              </button>
            </div>

            {trip.coverPath && covers.get(trip.coverPath) && (
              // 남의 서비스가 아니라 우리 보관함의 서명 주소다. 주소가 그때그때
              // 달라져 next/image 로 미리 최적화할 수 없다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={covers.get(trip.coverPath)}
                alt=""
                className="aspect-[16/10] w-full rounded-xl object-cover"
              />
            )}

            <ul className="flex flex-col gap-1">
              {trip.visits.map((visit, index) => (
                <li key={index} className="flex items-baseline gap-2 text-[15px]">
                  <span className="text-text-faint">▸</span>
                  {visit.spotId ? (
                    <Link
                      href={`/spots/${visit.spotId}`}
                      className="font-medium text-accent hover:text-accent-hover"
                    >
                      {visit.placeName}
                    </Link>
                  ) : (
                    <span className="font-medium text-text">{visit.placeName}</span>
                  )}
                  <span className="text-[13px] text-text-faint">사진 {visit.photoCount}장</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </>
  );
}
