"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import {
  filterSpots,
  suggestRelaxedFilters,
  type FilterCriteria,
  type RelaxationSuggestion,
} from "@/lib/filter";
import { FilterBar } from "@/components/filter/FilterBar";
import { SearchBox } from "@/components/filter/SearchBox";
import { SpotCard } from "@/components/spot/SpotCard";
import { KakaoMap } from "@/components/map/KakaoMap";
import { ViewToggle } from "@/components/layout/ViewToggle";

const SPOTS = spotsData as Spot[];

const RELAX_LABEL: Record<RelaxationSuggestion["relaxed"], string> = {
  regions: "권역",
  seasons: "계절",
  themes: "테마",
  query: "검색어",
};

export default function HomePage() {
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [mobileView, setMobileView] = useState<"list" | "map">("map");

  const results = useMemo(() => filterSpots(SPOTS, criteria), [criteria]);
  const suggestions = useMemo(
    () => (results.length === 0 ? suggestRelaxedFilters(SPOTS, criteria) : []),
    [results, criteria],
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-bold tracking-tight text-text md:text-[44px]">
              여행세상
            </h1>
            <p className="mt-1 text-[15px] text-text-muted">
              2025~2026 한국관광 100선, 조건으로 찾고 지도로 만나보세요
            </p>
          </div>
          <Link
            href="/regions"
            className="hidden shrink-0 rounded-full bg-bg-subtle px-4 py-2 text-[13px] font-medium text-text transition hover:bg-line md:block"
          >
            권역별로 둘러보기
          </Link>
        </div>
        <Link
          href="/regions"
          className="self-start rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text md:hidden"
        >
          권역별로 둘러보기
        </Link>
      </header>

      <SearchBox
        value={criteria.query ?? ""}
        onChange={(query) => setCriteria({ ...criteria, query: query || undefined })}
      />
      <FilterBar criteria={criteria} onChange={setCriteria} />
      <ViewToggle value={mobileView} onChange={setMobileView} />

      <p className="text-[13px] text-text-faint">{results.length}곳</p>

      {results.length === 0 && (
        // Rendered outside the list/map grid (not inside the list panel) so it's
        // visible on mobile regardless of which tab (리스트/지도) is active — the
        // list panel itself is hidden while mobileView is "map", so a message
        // placed inside it would silently disappear along with the panel,
        // leaving an empty map with no explanation.
        <div className="rounded-2xl bg-bg-subtle p-5 text-[15px] text-text-muted">
          조건에 맞는 곳이 없어요.
          {suggestions.map((s) => (
            <div key={s.relaxed} className="mt-1 text-[13px]">
              {RELAX_LABEL[s.relaxed]} 조건을 빼면 {s.count}곳 있어요.
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr] md:items-start">
        <div className={`${mobileView === "map" ? "hidden md:flex" : "flex"} flex-col gap-4`}>
          {results.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              selected={spot.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
        {/* Sticky on desktop so the map stays put while the list scrolls past it. */}
        <div
          className={`h-[70vh] overflow-hidden rounded-2xl ring-1 ring-line md:sticky md:top-6 ${mobileView === "list" ? "hidden md:block" : ""}`}
        >
          <KakaoMap spots={results} selectedId={selectedId} onMarkerClick={setSelectedId} />
        </div>
      </div>
    </main>
  );
}
