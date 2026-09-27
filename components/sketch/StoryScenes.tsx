"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { times } from "@/lib/sketchWords";
import { attachParticle } from "@/lib/korean";
import type { YearStory } from "@/lib/sketchStory";
import { getBrowserClient } from "@/lib/supabase/client";
import { signedUrls } from "@/lib/supabase/photos";
import { SIDO_ORDER } from "@/lib/sidoOrder";
import { PhotoViewer } from "@/components/trip/PhotoViewer";

/*
  그해를 장면마다 풀어 말한다.

  카드는 한눈에 보는 것이고, 이것은 한 줄씩 읽는 것이다. 숫자만 늘어놓지
  않고 말로 옮긴다 — "세 번 떠났어요", "여름에 가장 많이 떠났어요".

  할 말이 없는 장면은 아예 그리지 않는다. 빈칸을 보여 주며 탓하지 않는다.
*/

interface StoryScenesProps {
  story: YearStory;
  /** 원본 경로 → 목록 판(960px) 주소. */
  photoUrls: Map<string, string>;
  /**
   * 링크로 남에게 보여 주는 중. 원본을 받으러 가지 않고(남에게는 열리지
   * 않는다), 날짜를 적지 않고, 내 지도로 넘어가는 "다시 걷기"를 두지 않는다.
   */
  shared?: boolean;
}

/** "2026-08-13" → "8월 13일" */
const monthDay = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;

export function StoryScenes({ story, photoUrls, shared = false }: StoryScenesProps) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [big, setBig] = useState<Map<string, string>>(new Map());

  const open = async (index: number) => {
    setViewing(index);
    const path = story.photoPaths[index];
    if (shared || !path || big.has(path)) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    const url = (await signedUrls(supabase, [path])).get(path);
    if (url) setBig((current) => new Map(current).set(path, url));
  };

  const mostSeason = Math.max(1, ...story.seasons.map((bar) => bar.trips));
  const sido = SIDO_ORDER.filter((name) => story.sido.includes(name));
  const firsts = new Set(story.firstSido ?? []);

  return (
    <div className="flex flex-col">
      <Scene label={`${story.year}년의 나`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat big={times(story.tripCount)} small="떠났어요" />
          <Stat big={`${story.photoCount.toLocaleString("ko-KR")}장`} small="사진을 남겼어요" />
          <Stat big={`${story.placeCount}곳`} small="들렀어요" />
          {story.distanceKm > 0 && (
            <Stat
              big={`${story.distanceKm.toLocaleString("ko-KR")}km`}
              small={story.distanceWords ?? "옮겨 다녔어요 (직선거리)"}
            />
          )}
        </div>
      </Scene>

      {story.topPlace && (
        <Scene label="사진을 가장 많이 남긴 곳">
          <div className="flex items-center gap-4">
            <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-bg-subtle">
              {story.topPlace.photoPath && photoUrls.get(story.topPlace.photoPath) && (
                // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                <img
                  src={photoUrls.get(story.topPlace.photoPath)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[20px] font-bold tracking-tight text-text">
                {story.topPlace.placeName}
              </p>
              <p className="text-[14px] text-text-muted">
                사진 {story.topPlace.photoCount}장
                {story.topPlace.lastVisitedOn && ` · 마지막으로 ${monthDay(story.topPlace.lastVisitedOn)}`}
              </p>
            </div>
          </div>
        </Scene>
      )}

      {story.seasonLine && (
        <Scene label="계절">
          <div className="flex h-24 items-end gap-3">
            {story.seasons.map((bar) => (
              <div key={bar.season} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[12px] tabular-nums text-text-faint">{bar.trips || ""}</span>
                <span
                  className={`w-full rounded-t-md ${bar.trips === mostSeason ? "bg-accent" : "bg-line-strong"}`}
                  style={{ height: bar.trips > 0 ? `${Math.max(12, (bar.trips / mostSeason) * 56)}px` : "3px" }}
                />
                <span className="text-[13px] font-medium text-text-muted">{bar.season}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[16px] font-semibold text-text">{story.seasonLine}</p>
        </Scene>
      )}

      {sido.length > 0 && (
        <Scene label={`밟은 시도 ${sido.length}곳`}>
          <ul className="flex flex-wrap gap-2">
            {sido.map((name) => (
              <li
                key={name}
                className={`rounded-full px-3 py-1.5 text-[14px] font-medium ${
                  firsts.has(name) ? "bg-accent text-on-accent" : "bg-accent-soft text-accent"
                }`}
              >
                {name}
                {firsts.has(name) && <span className="ml-1 text-[11px] opacity-90">처음</span>}
              </li>
            ))}
          </ul>
          {story.firstSido && story.firstSido.length > 0 && (
            <p className="mt-3 text-[16px] font-semibold text-text">
              {story.firstSido.length === 1
                ? `${attachParticle(story.firstSido[0], "을", "를")} 처음 밟았어요`
                : `처음 밟은 시도가 ${story.firstSido.length}곳이에요`}
            </p>
          )}
        </Scene>
      )}

      {story.photoPaths.length > 0 && (
        <Scene label="그해의 사진">
          <div className="grid grid-cols-3 gap-1.5">
            {story.photoPaths.map((path, index) => (
              <button
                key={path}
                type="button"
                onClick={() => void open(index)}
                aria-label={`그해의 사진 ${index + 1} 크게 보기`}
                className="aspect-square overflow-hidden rounded-xl bg-bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {photoUrls.get(path) && (
                  // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                  <img src={photoUrls.get(path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        </Scene>
      )}

      {story.compare && (
        <Scene label={`${story.compare.previousYear}년과 견주면`}>
          <p className="text-[18px] font-semibold text-text">{story.compare.tripsLine}</p>
          {story.compare.photosLine && (
            <p className="mt-1 text-[15px] text-text-muted">{story.compare.photosLine}</p>
          )}
        </Scene>
      )}

      {story.companions.length > 0 && (
        <Scene label="누구와">
          <ul className="flex flex-wrap gap-2">
            {story.companions.map((entry) => (
              <li key={entry.label} className="rounded-full bg-bg-subtle px-3 py-1.5 text-[14px] text-text">
                {entry.label}
                <span className="ml-1 text-text-faint">{times(entry.count)}</span>
              </li>
            ))}
          </ul>
        </Scene>
      )}

      {/*
        읽고 나면 걷고 싶어진다. 그해가 골라진 채로 지도로 넘어간다 —
        거기서 ▶ 를 누르면 그해를 찍은 순서대로 따라간다.
      */}
      {!shared && (
        <Scene label="다시 걷기">
          <Link
            href={`/?v=sketch&y=${story.year}`}
            className="inline-flex items-center gap-2 rounded-full bg-bg-subtle px-4 py-2.5 text-[15px] font-medium text-accent transition hover:bg-accent-soft"
          >
            ▶ {story.year}년을 지도에서 다시 걷기
          </Link>
        </Scene>
      )}

      {viewing !== null && story.photoPaths[viewing] && (
        <PhotoViewer
          url={big.get(story.photoPaths[viewing]) ?? photoUrls.get(story.photoPaths[viewing]) ?? null}
          index={viewing}
          total={story.photoPaths.length}
          onClose={() => setViewing(null)}
          onPrev={() => void open((viewing - 1 + story.photoPaths.length) % story.photoPaths.length)}
          onNext={() => void open((viewing + 1) % story.photoPaths.length)}
        />
      )}
    </div>
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

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <p className="text-[28px] font-bold leading-tight tracking-tight text-text">{big}</p>
      <p className="mt-0.5 text-[14px] leading-snug text-text-muted">{small}</p>
    </div>
  );
}
