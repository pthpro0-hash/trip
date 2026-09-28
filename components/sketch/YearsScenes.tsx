"use client";

import type { ReactNode } from "react";
import { koreanCount, times } from "@/lib/sketchWords";
import type { YearRow, YearsStory } from "@/lib/yearsStory";
import { SIDO_ORDER } from "@/lib/sidoOrder";

/*
  해끼리 견준 장면들. 내 화면(AllYearsShowcase)과 링크 페이지가 같이 쓴다.

  해 줄을 누르면 그해 한 장으로 넘어간다 — 내 화면에서만. 링크로 받은
  사람에게는 넘어갈 곳이 없으니 onPickYear 를 주지 않으면 줄은 그냥 글이다.
*/

interface YearsScenesProps {
  story: Pick<YearsStory, "rows" | "sido" | "busiest" | "mostPhotos" | "mostNew">;
  onPickYear?: (year: number) => void;
}

export function YearsScenes({ story, onPickYear }: YearsScenesProps) {
  const mostTrips = Math.max(1, ...story.rows.map((row) => row.tripCount));
  const sido = SIDO_ORDER.filter((name) => story.sido.includes(name));
  const recentFirst = [...story.rows].reverse();

  return (
    <div className="flex flex-col">
      <Scene label="해마다">
        <ul className="flex flex-col gap-1">
          {recentFirst.map((row) => (
            <li key={row.year}>
              {onPickYear ? (
                <button
                  type="button"
                  onClick={() => onPickYear(row.year)}
                  aria-label={`${row.year}년 한 장 보기`}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-bg-subtle"
                >
                  <YearLine row={row} mostTrips={mostTrips} />
                  <span aria-hidden="true" className="text-text-faint">
                    ›
                  </span>
                </button>
              ) : (
                <div className="flex w-full items-center gap-3 px-2 py-2.5">
                  <YearLine row={row} mostTrips={mostTrips} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Scene>

      {(story.busiest || story.mostPhotos || story.mostNew) && (
        <Scene label="견주어 보면">
          <ul className="flex flex-col gap-2 text-[16px] text-text">
            {story.busiest && (
              <li>
                가장 많이 떠난 해는 <Year row={story.busiest} /> — {times(story.busiest.tripCount)}
              </li>
            )}
            {story.mostPhotos && (
              <li>
                사진을 가장 많이 남긴 해는 <Year row={story.mostPhotos} /> —{" "}
                {story.mostPhotos.photoCount.toLocaleString("ko-KR")}장
              </li>
            )}
            {story.mostNew && (
              <li>
                처음 밟은 시도가 가장 많던 해는 <Year row={story.mostNew} /> —{" "}
                {koreanCount(story.mostNew.newSidoCount ?? 0)} 곳
              </li>
            )}
          </ul>
        </Scene>
      )}

      {sido.length > 0 && (
        <Scene label={`지금까지 밟은 시도 ${sido.length}곳 / 17`}>
          <ul className="flex flex-wrap gap-2">
            {sido.map((name) => (
              <li key={name} className="rounded-full bg-accent-soft px-3 py-1.5 text-[14px] font-medium text-accent">
                {name}
              </li>
            ))}
          </ul>
        </Scene>
      )}
    </div>
  );
}

function YearLine({ row, mostTrips }: { row: YearRow; mostTrips: number }) {
  return (
    <>
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
      <span className="w-12 shrink-0 text-[16px] font-semibold tabular-nums text-text">{row.year}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="h-2 rounded-full bg-bg-subtle">
          <span
            className="block h-2 rounded-full"
            style={{ width: `${Math.max(4, (row.tripCount / mostTrips) * 100)}%`, background: row.color }}
          />
        </span>
        <span className="truncate text-[13px] text-text-muted">{rowLine(row)}</span>
      </span>
    </>
  );
}

function rowLine(row: YearRow): string {
  const parts = [`${row.tripCount}번`, `${row.placeCount}곳`, `사진 ${row.photoCount.toLocaleString("ko-KR")}장`];
  if (row.sidoCount > 0) {
    parts.push(row.newSidoCount ? `시도 ${row.sidoCount}곳(처음 ${row.newSidoCount})` : `시도 ${row.sidoCount}곳`);
  }
  return parts.join(" · ");
}

function Year({ row }: { row: YearRow }) {
  return (
    <strong className="font-semibold" style={{ color: row.color }}>
      {row.year}년
    </strong>
  );
}

function Scene({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="mb-4 text-[13px] font-semibold text-text-faint">{label}</h2>
      {children}
    </section>
  );
}
