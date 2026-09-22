"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { buildSketch, groupByYear, type SketchTrip } from "@/lib/sketch";
import { YearSketch } from "./YearSketch";

type Status = "loading" | "guest" | "failed" | "ready";

export function SketchView() {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [person, setPerson] = useState<string | null>(null);

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
      const rows = await fetchTrips(supabase, data.user.id);
      if (!active) return;
      if (!rows) {
        setStatus("failed");
        return;
      }
      setTrips(rows);
      setStatus("ready");
    });

    return () => {
      active = false;
    };
  }, []);

  const asSketchTrips: SketchTrip[] = useMemo(
    () =>
      trips.map((trip) => ({
        id: trip.id,
        startedOn: trip.startedOn,
        endedOn: trip.endedOn,
        companions: trip.companions,
        visits: trip.visits.map((visit) => ({
          placeName: visit.placeName,
          spotId: visit.spotId,
          lat: visit.lat,
          lng: visit.lng,
          photoCount: visit.photoCount,
        })),
      })),
    [trips],
  );

  const scoped = useMemo(
    () =>
      person
        ? asSketchTrips.filter((trip) => trip.companions?.trim() === person)
        : asSketchTrips,
    [asSketchTrips, person],
  );

  const whole = useMemo(() => buildSketch(asSketchTrips), [asSketchTrips]);
  // 해마다 한 장. 연도를 고르는 단추가 필요 없어졌다 — 다 펼쳐 놓는다.
  const years = useMemo(() => groupByYear(scoped), [scoped]);

  if (status === "loading") return <p className="text-[15px] text-text-faint">불러오는 중…</p>;

  if (status === "guest") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] text-text-muted">
          로그인하시면 지금까지의 여행을 한 장으로 모아 보여드려요.
        </p>
        <Link
          href="/login?next=%2Fsketch"
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
        <p className="text-[17px] font-medium text-text">아직 그릴 것이 없어요</p>
        <p className="text-[15px] leading-relaxed text-text-muted">
          여행을 기록하면 여기에 하나씩 쌓입니다.
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

  return (
    <>
      {/*
        연도 단추는 없앴다. 해마다 한 장씩 펼쳐 놓으므로 고를 것이 없다.
        사람은 남긴다 — 그건 여러 해에 걸쳐 걸러 보고 싶은 것이다.
      */}
      {whole.byCompanion.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-[13px] font-medium text-text-faint">함께</span>
          {whole.byCompanion.map((entry) => (
            <button
              key={entry.label}
              type="button"
              aria-pressed={person === entry.label}
              onClick={() => setPerson(person === entry.label ? null : entry.label)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                person === entry.label
                  ? "bg-accent text-on-accent"
                  : "bg-bg-subtle text-text hover:bg-line"
              }`}
            >
              {entry.label} {entry.count}
            </button>
          ))}
        </div>
      )}

      {years.length === 0 ? (
        <p className="rounded-2xl bg-bg-subtle p-5 text-[15px] text-text-muted">
          {person}와 다녀온 기록이 없어요.
        </p>
      ) : (
        years.map((entry) => (
          <YearSketch key={entry.year} year={entry.year} trips={entry.trips} person={person} />
        ))
      )}
    </>
  );
}
