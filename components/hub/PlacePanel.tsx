"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchPlacePhotos, signedUrls, thumbUrls, type PlacePhoto } from "@/lib/supabase/photos";
import { tripFocus } from "@/lib/scrollMemory";
import type { HubPlace } from "@/lib/hub";
import { PhotoViewer } from "@/components/trip/PhotoViewer";

/*
  지도에서 고른 곳.

  핀을 누르면 그곳에서 찍은 사진이 펼쳐진다. 같은 곳에 두 번 갔으면
  두 번 다 보인다 — 날짜마다 나눠서.

  사진은 누를 때 받는다. 지도를 여는 것만으로 수백 장의 주소를 만들
  이유가 없다.
*/

interface PlacePanelProps {
  userId: string;
  places: HubPlace[];
}

/** "2026-09-14 06:11:00" → "2026.09.14" */
const day = (stamp: string) => stamp.slice(0, 10).replaceAll("-", ".");

export function PlacePanel({ userId, places }: PlacePanelProps) {
  const [photos, setPhotos] = useState<PlacePhoto[] | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  const [big, setBig] = useState<Map<string, string>>(new Map());
  const [viewing, setViewing] = useState<number | null>(null);

  const visitKey = places.map((place) => place.visitId).join(",");

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    void (async () => {
      const list = await fetchPlacePhotos(supabase, userId, visitKey.split(","));
      if (!active) return;
      setPhotos(list);
      const urls = await thumbUrls(supabase, list.map((photo) => photo.storagePath));
      if (active) setThumbs(urls);
    })();

    return () => {
      active = false;
    };
  }, [userId, visitKey]);

  /** 방문마다 나눈다. 같은 곳을 두 번 간 사람에게는 그 두 날이 다르다. */
  const sections = useMemo(() => {
    const ordered = [...places].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return ordered.map((place) => ({
      place,
      photos: (photos ?? []).filter((photo) => photo.visitId === place.visitId),
    }));
  }, [places, photos]);

  /* 크게 볼 때는 이곳 사진을 한 줄로 이어 넘긴다. */
  const reel = useMemo(() => sections.flatMap((section) => section.photos), [sections]);

  const open = async (index: number) => {
    setViewing(index);
    const path = reel[index]?.storagePath;
    if (!path || big.has(path)) return;
    const supabase = getBrowserClient();
    if (!supabase) return;
    const url = (await signedUrls(supabase, [path])).get(path);
    if (url) setBig((current) => new Map(current).set(path, url));
  };

  const move = (step: number) => {
    if (viewing === null || reel.length === 0) return;
    void open((viewing + step + reel.length) % reel.length);
  };

  const lead = places[0];
  const title =
    new Set(places.map((place) => place.placeName)).size === 1
      ? lead.placeName
      : `${lead.placeName} 외 ${places.length - 1}곳`;

  return (
    <div className="flex flex-col gap-4">
      {/* 오른쪽 위는 창의 닫기 단추 자리다. */}
      <div className="pr-10">
        <div className="min-w-0">
          <h2 className="truncate text-[20px] font-bold tracking-tight text-text">
            {/* 한 이름이면 누르면 그 이름으로 다녀온 때를 모두 모아 본다. */}
            {title === lead.placeName ? (
              <Link
                href={`/places?name=${encodeURIComponent(lead.placeName)}`}
                className="underline decoration-line-strong underline-offset-4 hover:text-accent hover:decoration-accent"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">
            {places.length > 1 ? `${places.length}번 다녀왔어요` : day(lead.startedAt)}
            {" · "}사진 {places.reduce((sum, place) => sum + place.photoCount, 0)}장
          </p>
        </div>
      </div>

      {photos === null && <p className="text-[14px] text-text-faint">사진을 불러오고 있어요…</p>}

      {sections.map(({ place, photos: shots }) => (
        <section key={place.visitId} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-[13px] font-medium text-text-muted">
              {day(place.startedAt)} · {place.tripLabel}
            </p>
            <Link
              href={`/trips/${place.tripId}`}
              onClick={() => tripFocus.rememberFrom("/?v=sketch")}
              className="shrink-0 text-[13px] font-medium text-accent hover:text-accent-hover"
            >
              이 여행 전체 보기 →
            </Link>
          </div>

          {photos !== null && shots.length === 0 && (
            <p className="text-[13px] text-text-faint">이곳에는 올린 사진이 없어요.</p>
          )}

          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {shots.map((photo) => {
              const index = reel.indexOf(photo);
              const url = thumbs.get(photo.storagePath);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => void open(index)}
                  aria-label={`사진 ${index + 1} 크게 보기`}
                  className="aspect-square overflow-hidden rounded-lg bg-bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {viewing !== null && reel[viewing] && (
        <PhotoViewer
          url={big.get(reel[viewing].storagePath) ?? thumbs.get(reel[viewing].storagePath) ?? null}
          index={viewing}
          total={reel.length}
          onClose={() => setViewing(null)}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
        />
      )}
    </div>
  );
}
