"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SPOTS } from "@/lib/curatedData";
import { SIDO_NAMES, buildDex, type Dex as DexData } from "@/lib/sketchDex";
import type { SketchTrip } from "@/lib/sketch";

/*
  내 도감 — 한장 요약 아래에서 시도 칸과 여행 100선 칸에 도장을 찍어 보여 준다. 빈칸은 눌러서 그 곳의 100선 상세로 간다("다음엔 어디").
  시도 경계는 무거워(60KB) 이 화면이 열린 뒤에 불러온다. 불러오기 전에는 그리지 않는다.
*/
export function Dex({ all }: { all: SketchTrip[] }) {
  const [dex, setDex] = useState<DexData | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@/lib/sido").then((module) => {
      if (!alive) return;
      setDex(buildDex(all, SPOTS, SIDO_NAMES, module.sidoOf));
    });
    return () => {
      alive = false;
    };
  }, [all]);

  if (!dex || all.length === 0) return null;

  return (
    <section aria-label="내 도감" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-text-muted">내 도감</h3>
        <p className="text-[12px] text-text-faint">
          시도 {dex.sidoDone}/{dex.sidos.length} · 100선 {dex.spotDone}/{dex.spotTotal}
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {dex.sidos.map((sido) => (
          <li
            key={sido.name}
            className={`rounded-xl px-2 py-2 text-center text-[13px] ${
              sido.visited ? "bg-accent-soft font-semibold text-accent" : "bg-bg-subtle text-text-faint"
            }`}
          >
            {sido.name}
            <span className="sr-only">{sido.visited ? " 다녀옴" : " 아직"}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-1.5">
        {dex.sidos
          .filter((sido) => sido.spots.length > 0)
          .map((sido) => {
            const done = sido.spots.filter((spot) => spot.done).length;
            return (
              <details key={sido.name} className="rounded-xl bg-bg-subtle px-3.5 py-2.5">
                <summary className="flex cursor-pointer items-center justify-between text-[14px] font-medium text-text">
                  <span>{sido.name} 100선</span>
                  <span className="text-[12px] text-text-faint">
                    {done}/{sido.spots.length}
                  </span>
                </summary>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {sido.spots.map((spot) =>
                    spot.done ? (
                      <li key={spot.id} className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-medium text-accent">
                        ✓ {spot.name}
                      </li>
                    ) : (
                      <li key={spot.id}>
                        <Link
                          href={`/spots/${encodeURIComponent(spot.id)}`}
                          className="block rounded-full bg-surface px-3 py-1 text-[13px] text-text-muted ring-1 ring-line transition hover:text-text"
                        >
                          {spot.name}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </details>
            );
          })}
      </div>
    </section>
  );
}
