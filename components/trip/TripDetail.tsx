"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTripDetail, saveTripNote, type TripDetail as Detail } from "@/lib/supabase/tripDetail";
import { signedUrls } from "@/lib/supabase/photos";
import { companionLabel } from "@/lib/korean";
import { stayLabel, tripClues } from "@/lib/photo/clues";
import { CourseMap } from "@/components/course/CourseMap";

type Status = "loading" | "guest" | "missing" | "ready";

function formatSpan(startedOn: string, endedOn: string) {
  const short = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}월 ${Number(day)}일`;
  };
  const year = startedOn.slice(0, 4);
  if (startedOn === endedOn) return `${year}년 ${short(startedOn)}`;
  return `${year}년 ${short(startedOn)} ~ ${short(endedOn)}`;
}

function hourMinute(date: Date) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function TripDetail({ tripId }: { tripId: string }) {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trip, setTrip] = useState<Detail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

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

      const detail = await fetchTripDetail(supabase, data.user.id, tripId);
      if (!active) return;
      if (!detail) {
        setStatus("missing");
        return;
      }
      setTrip(detail);
      setNote(detail.note ?? "");
      setStatus("ready");

      const paths = detail.visits.flatMap((visit) => visit.photos.map((p) => p.storagePath));
      if (paths.length > 0) {
        const urls = await signedUrls(supabase, paths);
        if (active) setPhotoUrls(urls);
      }
    });

    return () => {
      active = false;
    };
  }, [tripId]);

  const submitNote = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;
    setSavingNote(true);
    setNoteSaved(false);
    const ok = await saveTripNote(supabase, userId, tripId, note);
    setSavingNote(false);
    setNoteSaved(ok);
  };

  if (status === "loading") return <p className="text-[15px] text-text-faint">불러오는 중…</p>;

  if (status === "guest") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">여행 기록은 로그인해야 볼 수 있어요.</p>
        <Link
          href={`/login?next=${encodeURIComponent(`/trips/${tripId}`)}`}
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          로그인하기
        </Link>
      </div>
    );
  }

  if (status === "missing" || !trip) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">그 여행을 찾지 못했어요.</p>
        <Link href="/trips" className="self-start text-[15px] font-medium text-accent">
          내 여행으로 →
        </Link>
      </div>
    );
  }

  const allPhotoTimes = trip.visits.flatMap((visit) => visit.photos.map((p) => p.takenAt));
  const clues = tripClues(trip.visits[0]?.startedAt ?? new Date(), allPhotoTimes, trip.visits.length);
  const stops = trip.visits.map((visit) => ({
    lat: visit.lat,
    lng: visit.lng,
    name: visit.placeName,
  }));

  return (
    <>
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">
          {formatSpan(trip.startedOn, trip.endedOn)}
        </h1>
        {trip.companions && (
          <p className="mt-1 text-[15px] text-text-muted">{companionLabel(trip.companions)}</p>
        )}
      </div>

      {stops.length > 0 && (
        <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-line">
          <CourseMap spots={stops} />
        </div>
      )}

      <ol className="flex flex-col gap-5">
        {trip.visits.map((visit, index) => {
          const stay = stayLabel(visit.startedAt, visit.endedAt);
          return (
            <li key={visit.id} className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-bold text-on-accent">
                  {index + 1}
                </span>
                {visit.spotId ? (
                  <Link
                    href={`/spots/${visit.spotId}`}
                    className="text-[17px] font-semibold tracking-tight text-accent hover:text-accent-hover"
                  >
                    {visit.placeName}
                  </Link>
                ) : (
                  <span className="text-[17px] font-semibold tracking-tight text-text">
                    {visit.placeName}
                  </span>
                )}
              </div>

              <p className="pl-8 text-[13px] text-text-faint">
                {hourMinute(visit.startedAt)}
                {hourMinute(visit.endedAt) !== hourMinute(visit.startedAt) &&
                  `~${hourMinute(visit.endedAt)}`}
                {stay && ` · ${stay}`}
                {visit.dong && ` · ${visit.dong}`}
              </p>

              {visit.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pl-8 sm:grid-cols-3">
                  {visit.photos.map((photo) => {
                    const url = photoUrls.get(photo.storagePath);
                    return (
                      <div
                        key={photo.id}
                        className="aspect-square overflow-hidden rounded-xl bg-bg-subtle"
                      >
                        {url && (
                          // 우리 보관함의 서명 주소라 그때그때 달라진다.
                          // next/image 로 미리 최적화할 수 없다.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/*
        빈 칸을 먼저 내밀지 않는다. 그날로 데려간 다음에 묻는다.
      */}
      <section className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-5">
        <p className="text-[14px] leading-relaxed text-text-muted">
          {clues.weekday}이었어요
          {clues.placeCount > 1 && ` · ${clues.placeCount}곳을 다니셨네요`}
          {clues.photoCount > 0 && ` · 사진 ${clues.photoCount}장`}
          {clues.busiestTime && ` · ${clues.busiestTime}에 가장 많이 찍으셨어요`}
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-faint">기억나는 일이 있나요?</span>
          <textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setNoteSaved(false);
            }}
            rows={3}
            placeholder="예: 비가 와서 우산 사러 편의점에 들렀다"
            className="resize-y rounded-xl bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={submitNote}
            disabled={savingNote}
            className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            {savingNote ? "적는 중…" : "적어두기"}
          </button>
          {noteSaved && <span className="text-[13px] text-text-muted">적어뒀어요.</span>}
          <span className="text-[13px] text-text-faint">나중에 쓰셔도 돼요.</span>
        </div>
      </section>
    </>
  );
}
