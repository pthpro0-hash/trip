"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import {
  filterSpots,
  suggestRelaxedFilters,
  type FilterCriteria,
  type RelaxationSuggestion,
} from "@/lib/filter";
import { sortByRelevance, suggestCorrection } from "@/lib/search";
import { reportEmptySearch } from "@/lib/searchTelemetry";
import { distanceKm } from "@/lib/geo";
import { useWishlist } from "@/lib/collections";
import { useMyLocation } from "@/lib/useMyLocation";
import { FilterBar } from "@/components/filter/FilterBar";
import { SearchBox } from "@/components/filter/SearchBox";
import { NearbyButton } from "@/components/filter/NearbyButton";
import { SpotCard } from "@/components/spot/SpotCard";
import { KakaoMap } from "@/components/map/KakaoMap";
import { ViewToggle } from "@/components/layout/ViewToggle";
import { RegionStrip } from "@/components/region/RegionStrip";
import { AccountChip } from "@/components/auth/AccountChip";

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
  const [savedOnly, setSavedOnly] = useState(false);
  // Searching is a "find this place" action, so results belong in the list —
  // but only until the reader says otherwise, after which their choice sticks.
  const [viewChosenByUser, setViewChosenByUser] = useState(false);

  const wishlist = useWishlist();
  const { state: location, request: requestLocation, clear: clearLocation } = useMyLocation();
  const origin = location.status === "ready" ? location.point : undefined;

  const query = criteria.query?.trim() ?? "";
  const results = useMemo(() => {
    const filtered = filterSpots(SPOTS, criteria);
    const scoped = savedOnly ? filtered.filter((spot) => wishlist.ids.includes(spot.id)) : filtered;
    const ranked = query ? sortByRelevance(scoped, query) : scoped;
    // 위치를 알고 있으면 가까운 순이 검색어 점수보다 우선한다. "내 주변"을
    // 누른 사람은 이미 무엇을 볼지 정했고, 남은 질문은 어디가 가깝냐다.
    if (!origin) return ranked;
    return [...ranked].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b));
  }, [criteria, query, savedOnly, wishlist.ids, origin]);

  const suggestions = useMemo(
    () => (results.length === 0 && !savedOnly ? suggestRelaxedFilters(SPOTS, criteria) : []),
    [results, criteria, savedOnly],
  );
  // 오타로 0건이 되는 경우가 잦아, 가장 가까운 이름을 되물어 본다.
  const correction = useMemo(
    () => (results.length === 0 && query ? suggestCorrection(SPOTS, query) : null),
    [results, query],
  );

  // 0건이 난 검색어를 모아 무엇을 보강할지 알아낸다.
  useEffect(() => {
    if (query && results.length === 0) reportEmptySearch(query);
  }, [query, results.length]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold tracking-tight text-text md:text-[44px]">나만의 여행 스케치</h1>
          <p className="mt-1 text-[15px] text-text-muted">
            2025~2026 한국관광 100선, 조건으로 찾고 지도로 만나보세요
          </p>
        </div>
        <AccountChip />
      </header>

      <RegionStrip spots={SPOTS} />

      <SearchBox
        value={criteria.query ?? ""}
        spots={SPOTS}
        onChange={(next) => {
          setCriteria({ ...criteria, query: next || undefined });
          if (next.trim() && !viewChosenByUser) setMobileView("list");
        }}
      />
      <FilterBar criteria={criteria} onChange={setCriteria} />

      <div className="flex flex-wrap items-center gap-2">
        <NearbyButton state={location} onRequest={requestLocation} onClear={clearLocation} />
        <Link
          href="/trips"
          className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
        >
          내 여행
        </Link>
        {wishlist.ids.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setSavedOnly(!savedOnly)}
              aria-pressed={savedOnly}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                savedOnly ? "bg-accent text-on-accent" : "bg-bg-subtle text-text hover:bg-line"
              }`}
            >
              가고 싶은 곳 {wishlist.ids.length}
            </button>
            <Link
              href="/course"
              className="text-[13px] font-medium text-accent hover:text-accent-hover"
            >
              이번 여행 →
            </Link>
          </>
        )}
      </div>

      <ViewToggle
        value={mobileView}
        onChange={(next) => {
          setViewChosenByUser(true);
          setMobileView(next);
        }}
      />

      <p className="text-[13px] text-text-faint">
        {query ? `'${query}' 검색 결과 ${results.length}곳` : `${results.length}곳`}
        {origin ? " · 가까운 순" : ""}
      </p>

      {results.length === 0 && (
        // Rendered outside the list/map grid (not inside the list panel) so it's
        // visible on mobile regardless of which tab (리스트/지도) is active — the
        // list panel itself is hidden while mobileView is "map", so a message
        // placed inside it would silently disappear along with the panel,
        // leaving an empty map with no explanation.
        <div className="rounded-2xl bg-bg-subtle p-5 text-[15px] text-text-muted">
          {savedOnly
            ? "가고 싶은 곳 중에는 조건에 맞는 곳이 없어요."
            : "조건에 맞는 곳이 없어요."}
          {correction && (
            <div className="mt-2">
              혹시{" "}
              <button
                type="button"
                onClick={() => setCriteria({ ...criteria, query: correction.name })}
                className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
              >
                {correction.name}
              </button>
              을 찾으셨나요?
            </div>
          )}
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
              query={query}
              distanceKm={origin ? distanceKm(origin, spot) : undefined}
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
