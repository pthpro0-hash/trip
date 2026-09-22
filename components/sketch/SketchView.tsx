"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { buildSketch, groupByYear, type SketchTrip } from "@/lib/sketch";
import { regionsOfTrip } from "@/lib/photo/region";
import { REGIONS } from "@/lib/regions";
import { searchTrips, type SearchableTrip } from "@/lib/tripSearch";
import type { Region } from "@/lib/types";
import { YearSketch } from "./YearSketch";

type Status = "loading" | "guest" | "failed" | "ready";

export function SketchView() {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [person, setPerson] = useState<string | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [query, setQuery] = useState("");

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
          dong: visit.dong,
        })),
      })),
    [trips],
  );

  /*
    찾기는 목록과 같은 규칙을 쓴다. "작년 가족 해변"처럼 시기·사람·장소를
    한 줄에 섞어 던져도 받아낸다 — 두 화면이 다르게 찾으면 사람이 헷갈린다.
  */
  const searchable: SearchableTrip[] = useMemo(
    () =>
      trips.map((trip) => ({
        id: trip.id,
        title: trip.title,
        startedOn: trip.startedOn,
        endedOn: trip.endedOn,
        companions: trip.companions,
        note: trip.note,
        placeNames: trip.visits.map((visit) => visit.placeName),
        dongs: trip.visits.map((visit) => visit.dong).filter((d): d is string => !!d),
      })),
    [trips],
  );

  /** 기록에 실제로 나오는 권역만 단추로 내놓는다. */
  const regionsSeen = useMemo(() => {
    const seen = new Set<Region>();
    for (const trip of asSketchTrips) {
      for (const found of regionsOfTrip(trip.visits)) seen.add(found);
    }
    return REGIONS.filter((one) => seen.has(one));
  }, [asSketchTrips]);

  const scoped = useMemo(() => {
    const matched = new Set(searchTrips(searchable, query).map((trip) => trip.id));
    return asSketchTrips.filter((trip) => {
      if (query.trim() && !matched.has(trip.id)) return false;
      if (person && trip.companions?.trim() !== person) return false;
      if (year !== null && Number(trip.startedOn.slice(0, 4)) !== year) return false;
      if (region && !regionsOfTrip(trip.visits).includes(region)) return false;
      return true;
    });
  }, [asSketchTrips, searchable, query, person, year, region]);

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

  const chosen = Boolean(person || region || year !== null || query.trim());

  /** 고른 것을 모두 푼다. 걸러 놓고 빠져나오지 못하는 일이 없게. */
  const clear = () => {
    setPerson(null);
    setRegion(null);
    setYear(null);
    setQuery("");
  };

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="작년 가족, 해변, 강릉시…"
          aria-label="기록 찾기"
          className="w-full rounded-xl bg-bg-subtle px-4 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />

        {regionsSeen.length > 1 && (
          <Chips label="권역">
            {regionsSeen.map((one) => (
              <Chip
                key={one}
                on={region === one}
                onClick={() => setRegion(region === one ? null : one)}
              >
                {one}
              </Chip>
            ))}
          </Chips>
        )}

        {/*
          해마다 한 장씩 펼치므로 연도를 고르지 않아도 다 보인다. 다만
          해가 쌓이면 한 해만 보고 싶어진다 — 그때를 위한 것이다.
        */}
        {whole.byYear.length > 1 && (
          <Chips label="해">
            {whole.byYear.map((entry) => {
              const value = Number(entry.label);
              return (
                <Chip
                  key={entry.label}
                  on={year === value}
                  onClick={() => setYear(year === value ? null : value)}
                >
                  {entry.label}년
                </Chip>
              );
            })}
          </Chips>
        )}

        {whole.byCompanion.length > 0 && (
          <Chips label="함께">
            {whole.byCompanion.map((entry) => (
              <Chip
                key={entry.label}
                on={person === entry.label}
                onClick={() => setPerson(person === entry.label ? null : entry.label)}
              >
                {entry.label} {entry.count}
              </Chip>
            ))}
          </Chips>
        )}

        {chosen && (
          <button
            type="button"
            onClick={clear}
            className="self-start text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            조건 모두 풀기
          </button>
        )}
      </div>

      {years.length === 0 ? (
        <p className="rounded-2xl bg-bg-subtle p-5 text-[15px] text-text-muted">
          그 조건에 맞는 여행이 없어요. 조건을 하나씩 빼 보세요.
        </p>
      ) : (
        years.map((entry) => (
          <YearSketch
            key={entry.year}
            year={entry.year}
            trips={entry.trips}
            person={person}
            region={region}
          />
        ))
      )}
    </>
  );
}

/** 이름표 하나에 단추 여럿. 줄이 여럿이어도 왼쪽 끝이 맞는다. */
function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-9 shrink-0 text-[13px] font-medium text-text-faint">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
        on ? "bg-accent text-on-accent" : "bg-bg-subtle text-text hover:bg-line"
      }`}
    >
      {children}
    </button>
  );
}
