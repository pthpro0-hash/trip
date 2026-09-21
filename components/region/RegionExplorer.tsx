"use client";

import { useMemo, useState } from "react";
import type { Region, Season, Spot, Theme } from "@/lib/types";
import { ALL_SEASONS, ALL_THEMES, filterSpots } from "@/lib/filter";
import { splitRegionIntoClusters } from "@/lib/regionClusters";
import { availableSeasons, availableThemes, regionStats } from "@/lib/regionStats";
import { SpotCard } from "@/components/spot/SpotCard";
import { RegionMap } from "./RegionMap";

interface RegionExplorerProps {
  region: Region;
  spots: Spot[];
}

const SUMMARY_THEMES = 3;
const SUMMARY_SEASONS = 2;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function RegionExplorer({ region, spots }: RegionExplorerProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedId, setSelectedId] = useState<string>();

  const stats = useMemo(() => regionStats(spots), [spots]);
  const themeOptions = useMemo(() => availableThemes(spots, ALL_THEMES), [spots]);
  const seasonOptions = useMemo(() => availableSeasons(spots, ALL_SEASONS), [spots]);

  const filtered = useMemo(
    () =>
      filterSpots(spots, {
        themes: themes.length > 0 ? themes : undefined,
        seasons: seasons.length > 0 ? seasons : undefined,
      }),
    [spots, themes, seasons],
  );

  // 지도가 많을수록 한 장에 담긴 이름이 겹친다. 지리적으로 가까운 것끼리
  // 묶어 여러 장으로 나누는 규칙은 lib/regionClusters.ts에 있다.
  const clusters = useMemo(() => splitRegionIntoClusters(filtered), [filtered]);

  const filtering = themes.length > 0 || seasons.length > 0;
  /*
    RegionMap은 "한 번 그리고 그대로 두는" 지도다 — 라벨 배치가 그 화면
    그대로를 전제로 계산되어 있어 다시 그리지 않는다. 조건이 바뀌면
    key를 갈아 새 지도를 받는 편이 그 전제를 깨지 않는 길이다.
  */
  const mapKey = `${themes.join(",")}|${seasons.join(",")}`;

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]">
          <span className="text-text-faint">이 권역은</span>
          {stats.themes.slice(0, SUMMARY_THEMES).map((theme) => (
            <span key={theme.value} className="font-medium text-text">
              {theme.value}
              <span className="text-text-faint"> {theme.count}</span>
            </span>
          ))}
          <span className="text-text-faint">이 많아요.</span>
        </div>

        {stats.seasons.length > 0 && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[15px]">
            <span className="text-text-faint">좋은 때는</span>
            {stats.seasons.slice(0, SUMMARY_SEASONS).map((season) => (
              <span key={season.value} className="font-medium text-text">
                {season.value}
                <span className="text-text-faint"> {season.count}곳</span>
              </span>
            ))}
            {stats.allYearCount > 0 && (
              <span className="text-text-faint">· 사계절 {stats.allYearCount}곳</span>
            )}
          </div>
        )}

        {stats.foods.length > 0 && (
          <div className="text-[15px]">
            <span className="text-text-faint">대표 음식: </span>
            <span className="text-text">
              {stats.foods.slice(0, 5).map((food) => food.value).join(", ")}
            </span>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2.5">
        <ChipRow
          label="테마"
          options={themeOptions}
          selected={themes}
          onToggle={(value) => setThemes(toggle(themes, value))}
        />
        <ChipRow
          label="계절"
          options={seasonOptions}
          selected={seasons}
          onToggle={(value) => setSeasons(toggle(seasons, value))}
        />
      </div>

      <div className="flex items-center gap-3">
        <p className="text-[13px] text-text-faint">
          {filtering ? `조건에 맞는 ${filtered.length}곳` : `${filtered.length}곳`}
        </p>
        {filtering && (
          <button
            type="button"
            onClick={() => {
              setThemes([]);
              setSeasons([]);
            }}
            className="text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            조건 지우기
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-bg-subtle p-5 text-[15px] text-text-muted">
          {region}에는 그 조건에 맞는 곳이 없어요. 조건을 하나씩 빼 보세요.
        </p>
      ) : (
        <>
          {clusters.map((cluster) => (
            <RegionMap
              key={`${mapKey}|${cluster.label || region}`}
              region={region}
              spots={cluster.spots}
              label={cluster.label}
            />
          ))}

          <section className="flex flex-col gap-3">
            <h2 className="text-[20px] font-semibold tracking-tight text-text">
              {region} 여행지
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((spot) => (
                <SpotCard
                  key={spot.id}
                  spot={spot}
                  selected={spot.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function ChipRow<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-8 shrink-0 text-[13px] font-medium text-text-faint">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={selected.includes(option)}
          onClick={() => onToggle(option)}
          className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
            selected.includes(option)
              ? "bg-accent text-on-accent"
              : "bg-bg-subtle text-text hover:bg-line"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
