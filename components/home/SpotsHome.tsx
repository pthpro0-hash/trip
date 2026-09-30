"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { HomeIntro } from "@/components/home/HomeIntro";
import { ScrollTop } from "@/components/layout/ScrollTop";
import { restoreToCard, spotFocus } from "@/lib/scrollMemory";
import { useHydrated } from "@/lib/useHydrated";

const SPOTS = spotsData as Spot[];

const RELAX_LABEL: Record<RelaxationSuggestion["relaxed"], string> = {
  regions: "권역",
  seasons: "계절",
  themes: "테마",
  query: "검색어",
};

interface SpotsHomeProps {
  /** 맨 위에 둘 큰 갈래(내 여행 · 여행 100선). */
  switcher?: ReactNode;
}

export function SpotsHome({ switcher }: SpotsHomeProps = {}) {
  const [criteria, setCriteria] = useState<FilterCriteria>({});
  const [selectedId, setSelectedId] = useState<string>();
  const [mobileView, setMobileView] = useState<"list" | "map">("map");
  /*
    상세를 보고 돌아온 사람. 어느 카드 앞에 세울지.

    붙기 전에는 모르는 척한다. 저장소는 브라우저에만 있어 서버가 그린
    화면에는 이 사실이 없고, 처음부터 다르게 그리면 React 가 서버가 그린
    것을 그대로 두어 아무 일도 일어나지 않는다. useHydrated 에 그 사연을
    적어 두었다.
  */
  const hydrated = useHydrated();
  const [mark] = useState(() => spotFocus.peek());
  const focus = hydrated ? mark : null;
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

  /*
    돌아온 사람을 그 여행지 카드 앞에 세운다.

    한 번에 되지 않는다. 사진이 뒤늦게 들어오고 안내 띠가 끼어들며
    높이가 바뀌므로, 카드가 제자리에 앉을 때까지 되짚는다. 손을 대면
    그 즉시 그만둔다.
  */
  useEffect(() => {
    if (!focus) return;
    return restoreToCard(spotFocus.cardId(focus), spotFocus.forget);
  }, [focus]);

  /*
    돌아온 사람에게는 목록을 편다.

    좁은 화면의 기본은 지도인데, 목록에서 카드를 눌러 들어갔던 사람을
    지도로 돌려보내면 보던 자리가 아예 화면에서 사라진다. 사람이 직접
    고른 적이 있으면 그 뜻을 따른다 — 검색이 하는 것과 같은 규칙이다.
  */
  const view = focus && !viewChosenByUser ? "list" : mobileView;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-6">
      {/* 폰에서는 접는다 — 큰 갈래는 아래 하단 탭이 이미 하고 있다. */}
      {switcher && <div className="flex justify-center max-sm:hidden">{switcher}</div>}
      {/*
        머리글은 서비스 이름이 아니라 이 면이 무엇인지를 말한다. 이름은
        위 띠가 이미 들고 있고, 사람들이 찾는 말은 "한국관광 100선"이다.
      */}
      <header>
        <h1 className="text-[34px] font-bold tracking-tight text-text md:text-[44px]">
          한국관광 100선
        </h1>
        <p className="mt-1 text-[15px] text-text-muted">
          2025~2026년 121곳, 조건으로 찾고 지도로 만나보세요
        </p>
      </header>

      <HomeIntro />

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
        value={view}
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
        <div className={`${view === "map" ? "hidden md:flex" : "flex"} flex-col gap-4`}>
          {results.map((spot) => (
            <SpotCard
              key={spot.id}
              spot={spot}
              selected={spot.id === selectedId}
              query={query}
              distanceKm={origin ? distanceKm(origin, spot) : undefined}
              focused={focus === spot.id}
            />
          ))}
        </div>
        {/* Sticky on desktop so the map stays put while the list scrolls past it. */}
        <div
          className={`h-[70vh] overflow-hidden rounded-2xl ring-1 ring-line md:sticky md:top-6 ${view === "list" ? "hidden md:block" : ""}`}
        >
          <KakaoMap spots={results} selectedId={selectedId} onMarkerClick={setSelectedId} />
        </div>
      </div>

      {/*
        어디까지 내려가 있든 사진을 넣을 수 있게 떠 있는다. 목록이 길어
        아래에서 다시 위로 올라가야 하는 일이 없도록.
      */}
      {/* 목록이 121곳이라 화면이 길다. 늘 같은 자리에 둔다. */}
      <ScrollTop raised />

      {/*
        폰에서는 접는다 — 하단 탭의 가운데 단추가 같은 일을 한다. 이름은 어디서나
        "사진 고르기"다(예전에는 여기만 "여행 스케치 그리기"였다).
      */}
      <Link
        href="/trips/new"
        className="fixed bottom-5 right-5 z-20 flex items-center gap-1.5 rounded-full bg-accent px-4 py-3 text-[14px] font-medium text-on-accent shadow-lg transition hover:bg-accent-hover max-sm:hidden"
      >
        <span aria-hidden="true">📷</span>
        사진 고르기
      </Link>
    </main>
  );
}
