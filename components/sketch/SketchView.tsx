"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { buildSketch, sketchPoints, type SketchTrip } from "@/lib/sketch";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { SketchCard } from "./SketchCard";

type Status = "loading" | "guest" | "failed" | "ready";

export function SketchView() {
  const holderRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

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
      asSketchTrips.filter((trip) => {
        if (year !== null && Number(trip.startedOn.slice(0, 4)) !== year) return false;
        if (person && trip.companions?.trim() !== person) return false;
        return true;
      }),
    [asSketchTrips, year, person],
  );

  const whole = useMemo(() => buildSketch(asSketchTrips), [asSketchTrips]);
  const sketch = useMemo(() => buildSketch(scoped), [scoped]);
  const points = useMemo(() => sketchPoints(scoped), [scoped]);

  const title = person
    ? `${person}와의 여행`
    : year !== null
      ? `${year}년의 여행`
      : "나의 여행 스케치";

  const save = async () => {
    const svg = holderRef.current?.querySelector("svg");
    if (!svg) return;
    setSaving(true);
    setSaveFailed(false);
    const ok = await downloadSvgAsPng(svg, `여행스케치-${title}.png`);
    if (!ok) setSaveFailed(true);
    setSaving(false);
  };

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
      <div className="flex flex-col gap-2.5">
        {whole.byYear.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-8 shrink-0 text-[13px] font-medium text-text-faint">해</span>
            {whole.byYear.map((entry) => {
              const value = Number(entry.label);
              return (
                <button
                  key={entry.label}
                  type="button"
                  aria-pressed={year === value}
                  onClick={() => setYear(year === value ? null : value)}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                    year === value ? "bg-accent text-on-accent" : "bg-bg-subtle text-text hover:bg-line"
                  }`}
                >
                  {entry.label}년
                </button>
              );
            })}
          </div>
        )}

        {whole.byCompanion.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-8 shrink-0 text-[13px] font-medium text-text-faint">사람</span>
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
      </div>

      {sketch.tripCount === 0 ? (
        <p className="rounded-2xl bg-bg-subtle p-5 text-[15px] text-text-muted">
          그 조건에 맞는 여행이 없어요.
        </p>
      ) : (
        <>
          {/* 저장할 때 이 안의 SVG 를 그대로 꺼내 그림으로 바꾼다. */}
          <div ref={holderRef} className="overflow-hidden rounded-2xl ring-1 ring-line">
            <SketchCard sketch={sketch} points={points} title={title} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? "만드는 중…" : "그림으로 저장하기"}
            </button>
            {saveFailed && (
              <span className="text-[13px] text-text-muted">저장하지 못했어요.</span>
            )}
            {sketch.topCompanion && !person && (
              <span className="text-[13px] text-text-faint">
                {sketch.topCompanion.label}와 가장 많이 다니셨어요
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}
