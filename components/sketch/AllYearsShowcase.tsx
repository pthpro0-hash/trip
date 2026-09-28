"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type { SketchTrip } from "@/lib/sketch";
import type { SidoOf } from "@/lib/sketchStory";
import { headline, koreanCount, times } from "@/lib/sketchWords";
import { yearsStory, type YearRow } from "@/lib/yearsStory";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { SIDO_ORDER } from "@/lib/sidoOrder";
import { WaitingOverlay } from "@/components/layout/Waiting";
import { YearsCard } from "./YearsCard";

/*
  지금까지 전부.

  한 해 화면이 "그해 어땠나"라면 이것은 "해마다 어떻게 달라졌나"다.
  카드는 해마다 색을 달리해 한 장에 겹치고, 그 아래에서 해끼리 견준다 —
  가장 많이 떠난 해, 사진을 가장 많이 남긴 해, 처음 밟은 곳이 가장 많던 해.
  해 줄을 누르면 그해 한 장으로 넘어간다.
*/

interface AllYearsShowcaseProps {
  all: SketchTrip[];
  sidoOf: SidoOf | undefined;
  onPickYear: (year: number) => void;
}

export function AllYearsShowcase({ all, sidoOf, onPickYear }: AllYearsShowcaseProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"card" | "story" | null>(null);
  const [failed, setFailed] = useState(false);

  const story = useMemo(() => yearsStory(all, sidoOf), [all, sidoOf]);
  const line = useMemo(() => headline(story.total, "all"), [story]);
  const mostTrips = Math.max(1, ...story.rows.map((row) => row.tripCount));
  const sido = SIDO_ORDER.filter((name) => story.sido.includes(name));

  const save = async (kind: "card" | "story") => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    setSaving(kind);
    setFailed(false);
    const name = kind === "story" ? "여행스케치-지금까지-세로.png" : "여행스케치-지금까지.png";
    if (!(await downloadSvgAsPng(svg, name, { story: kind === "story" }))) setFailed(true);
    setSaving(null);
  };

  const recentFirst = [...story.rows].reverse();

  return (
    <article className="flex flex-col gap-5">
      {saving && <WaitingOverlay title="그림을 만들고 있어요" note="다 되면 저절로 받아져요." />}

      <header className="flex flex-col gap-1">
        <p className="text-[24px] font-bold leading-snug tracking-tight text-text md:text-[28px]">{line}</p>
        <p className="text-[15px] text-text-muted">{story.spanLine}</p>
      </header>

      <div ref={holder} className="overflow-hidden rounded-2xl ring-1 ring-line">
        <YearsCard stats={story.total} headline={line} layers={story.layers} rows={story.rows} />
      </div>

      <div className="flex flex-col">
        <Scene label="해마다">
          <ul className="flex flex-col gap-1">
            {recentFirst.map((row) => (
              <li key={row.year}>
                <button
                  type="button"
                  onClick={() => onPickYear(row.year)}
                  aria-label={`${row.year}년 한 장 보기`}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-bg-subtle"
                >
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
                  <span aria-hidden="true" className="text-text-faint">
                    ›
                  </span>
                </button>
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

      <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-col gap-1.5 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        {failed && <p className="text-[13px] text-text-muted">저장하지 못했어요.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save("card")}
            disabled={saving !== null}
            aria-label="지금까지 이미지 저장"
            className="flex-1 rounded-full bg-accent px-1.5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            이미지 저장
          </button>
          <button
            type="button"
            onClick={() => void save("story")}
            disabled={saving !== null}
            className="flex-1 rounded-full bg-bg-subtle px-1.5 py-2.5 text-[14px] font-medium text-text transition hover:bg-line disabled:opacity-60"
          >
            스토리용 세로
          </button>
        </div>
      </div>
    </article>
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
