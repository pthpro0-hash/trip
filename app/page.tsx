"use client";

import { useMemo, useState } from "react";
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
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="relative overflow-hidden rounded-2xl border border-[var(--color-border-warm)] bg-gold px-6 py-8 text-center shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/15"
        />
        <h1 className="relative font-[family-name:var(--font-jua)] text-4xl text-brown md:text-5xl">
          여행세상
        </h1>
      </header>
      <p className="text-center text-sm font-medium text-brown">
        2025~2026 한국관광 100선, 조건으로 찾고 지도로 만나보세요
      </p>
      <SearchBox
        value={criteria.query ?? ""}
        onChange={(query) => setCriteria({ ...criteria, query: query || undefined })}
      />
      <FilterBar criteria={criteria} onChange={setCriteria} />
      <ViewToggle value={mobileView} onChange={setMobileView} />

      {results.length === 0 && (
        // Rendered outside the list/map grid (not inside the list panel) so it's
        // visible on mobile regardless of which tab (리스트/지도) is active — the
        // list panel itself is hidden while mobileView is "map", so a message
        // placed inside it would silently disappear along with the panel,
        // leaving an empty map with no explanation.
        <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
          조건에 맞는 곳이 없어요.
          {suggestions.map((s) => (
            <div key={s.relaxed}>
              {RELAX_LABEL[s.relaxed]} 조건을 빼면 {s.count}곳 있어요.
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className={`${mobileView === "map" ? "hidden md:flex" : "flex"} flex-col gap-2`}>
          {results.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              selected={spot.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}
        </div>
        <div className={`h-[500px] ${mobileView === "list" ? "hidden md:block" : ""}`}>
          <KakaoMap spots={results} selectedId={selectedId} onMarkerClick={setSelectedId} />
        </div>
      </div>
    </main>
  );
}
