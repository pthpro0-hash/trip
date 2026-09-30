"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { times } from "@/lib/sketchWords";
import { attachParticle } from "@/lib/korean";
import { PLACE_SHOWN, type StoryPlace, type YearStory } from "@/lib/sketchStory";
import { getBrowserClient } from "@/lib/supabase/client";
import { signedUrls } from "@/lib/supabase/photos";
import { tripFocus } from "@/lib/scrollMemory";
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
   * "그해의 곳들"의 작은 사진(핀 판, 160px) 주소. 주면 목록은 이것만 쓴다 — 줄마다
   * 큰 판을 받으면 열 장에 1MB 가까이 내려받는다. 주지 않으면 photoUrls 를 쓴다
   * (링크로 받은 화면에는 작은 판이 없다).
   */
  placeUrls?: Map<string, string>;
  /**
   * 곳을 눌러 여행 상세로 갔다가 돌아올 곳("/sketch?y=2026"). 누를 때 적어 둔다.
   * 상세의 되돌아가기가 이것을 따라, 보던 해의 한장 요약으로 돌아온다.
   */
  backHref?: string;
  /**
   * 링크로 남에게 보여 주는 중. 원본을 받으러 가지 않고(남에게는 열리지
   * 않는다), 날짜를 달까지만 적고, 곳을 눌러도 갈 곳이 없고, 내 지도로 넘어가는
   * "지도에서 보기"를 두지 않는다.
   */
  shared?: boolean;
}

/** "2026-08-13" → "8월 13일" */
const monthDay = (day: string) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;

/** 곳 줄의 날짜. "2026-08-13" → "8월 13일", 달까지만 있으면("2026-08") "8월". 모르면 "". */
function placeDate(day: string): string {
  const month = Number(day.slice(5, 7));
  if (!(month >= 1 && month <= 12)) return "";
  return day.length >= 10 ? monthDay(day) : `${month}월`;
}

export function StoryScenes({ story, photoUrls, placeUrls, backHref, shared = false }: StoryScenesProps) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [big, setBig] = useState<Map<string, string>>(new Map());
  const [allPlaces, setAllPlaces] = useState(false);

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

  /*
    그해의 곳들. 카드의 점에 이름을 붙여 날짜순으로 늘어놓는다 — 카드가 포스터라면
    이 목록은 차례다. 처음에는 사진 가장 많은 열 곳만 보이고(rank 가 그 순서다),
    나머지는 "더 보기"로 편다. 예전에 따로 있던 "사진을 가장 많이 남긴 곳"은
    이 목록의 첫째 줄에 표시로 남았다.

    사진이 하나도 없으면(사진 없이 가져왔거나 링크가 "지도만") 사진 자리를 아예
    두지 않는다. 자리만 비워 두면 다 빠진 것처럼 보인다.
  */
  const shownPlaces = allPlaces ? story.places : story.places.filter((place) => place.rank < PLACE_SHOWN);
  const morePlaces = story.places.length - PLACE_SHOWN;
  const anyPhoto = story.places.some((place) => place.photoPath);
  const thumbs = placeUrls ?? photoUrls;

  return (
    <div className="flex flex-col">
      {story.places.length > 0 && (
        <Scene label="그해의 곳들">
          <ul className="-my-1 flex flex-col">
            {shownPlaces.map((place, index) => (
              <PlaceRow
                key={`${index}-${place.placeName}`}
                place={place}
                crown={story.places.length > 1 && place.rank === 0}
                withTile={anyPhoto}
                thumb={place.photoPath ? thumbs.get(place.photoPath) : undefined}
                linked={!shared && place.tripId !== ""}
                onOpen={() => backHref && tripFocus.rememberFrom(backHref)}
              />
            ))}
          </ul>
          {morePlaces > 0 && (
            <button
              type="button"
              aria-expanded={allPlaces}
              onClick={() => setAllPlaces((open) => !open)}
              className="mt-3 rounded-full bg-bg-subtle px-4 py-2 text-[14px] font-medium text-text transition hover:bg-line"
            >
              {allPlaces ? "접기" : `${morePlaces}곳 더 보기`}
            </button>
          )}
        </Scene>
      )}

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
        거기서 그해가 찍힌 곳만 남아 보인다.
      */}
      {!shared && (
        <Scene label="지도에서 보기">
          <Link
            href={`/?v=sketch&y=${story.year}`}
            className="inline-flex items-center gap-2 rounded-full bg-bg-subtle px-4 py-2.5 text-[15px] font-medium text-accent transition hover:bg-accent-soft"
          >
            {story.year}년을 지도에서 보기
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

/** 그해의 곳 한 줄. 내 화면에서는 그 여행의 상세로 가는 문이고, 링크로 받은 화면에서는 읽기만 한다. */
function PlaceRow({
  place,
  crown,
  withTile,
  thumb,
  linked,
  onOpen,
}: {
  place: StoryPlace;
  /** 사진을 가장 많이 남긴 곳. */
  crown: boolean;
  /** 사진 자리를 둘지. 어느 줄에도 사진이 없으면 두지 않는다. */
  withTile: boolean;
  thumb: string | undefined;
  linked: boolean;
  onOpen: () => void;
}) {
  const date = placeDate(place.lastVisitedOn);
  const revisit = place.visits > 1;
  // 여러 번 갔으면 날짜는 마지막으로 간 날이고, 누르면 그 여행으로 간다.
  const meta = [date && (revisit ? `마지막 ${date}` : date), `사진 ${place.photoCount.toLocaleString("ko-KR")}장`]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <>
      {withTile && (
        <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-bg-subtle">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-[20px] opacity-60">
              📍
            </span>
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-text">{place.placeName}</span>
        <span className="block text-[13px] text-text-muted">{meta}</span>
        {(crown || revisit) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            {crown && (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">가장 많이 찍은 곳</span>
            )}
            {revisit && <span className="text-text-faint">{times(place.visits)} 다녀왔어요</span>}
          </span>
        )}
      </span>
      {linked && (
        <span aria-hidden="true" className="shrink-0 text-[22px] leading-none text-text-faint">
          ›
        </span>
      )}
    </>
  );

  return (
    <li>
      {linked ? (
        <Link
          href={`/trips/${place.tripId}`}
          onClick={onOpen}
          className="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-center gap-3 py-2">{body}</div>
      )}
    </li>
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
