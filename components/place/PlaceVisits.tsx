"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchVisitsByName, type PlaceVisit } from "@/lib/supabase/placeVisits";
import { fetchPlacePhotos, signedUrls, thumbUrls, type PlacePhoto } from "@/lib/supabase/photos";
import { tripFocus } from "@/lib/scrollMemory";
import { LIST_HREF } from "@/lib/nav";
import { times } from "@/lib/sketchWords";
import { PhotoViewer } from "@/components/trip/PhotoViewer";
import { Waiting } from "@/components/layout/Waiting";

/*
  같은 이름으로 다녀온 때를 모아 본다.

  여행 상세에서 곳 이름을 누르면 온다. 한 곳을 여러 번 갔으면 그때마다
  무엇을 찍었는지가 해를 건너 한 줄로 이어진다 — 최근부터.

  이름이 조금이라도 다르면 따로 모인다. 그래서 맨 아래에 이름을 맞추는
  법을 한 줄 적어 둔다.
*/

type Status = "loading" | "guest" | "failed" | "ready";

/** 한 번에 보여 줄 사진. 더 있으면 "+N". */
const PHOTOS_PER_VISIT = 6;

/** "2026-08-13T..." → "2026년 8월 13일" */
const dayOf = (at: string) => `${at.slice(0, 4)}년 ${Number(at.slice(5, 7))}월 ${Number(at.slice(8, 10))}일`;
/** "2026-08-13T..." → "2026년 8월" */
const monthOf = (at: string) => `${at.slice(0, 4)}년 ${Number(at.slice(5, 7))}월`;

export function PlaceVisits({ name }: { name: string }) {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [visits, setVisits] = useState<PlaceVisit[]>([]);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [big, setBig] = useState<Map<string, string>>(new Map());
  const [viewing, setViewing] = useState<number | null>(null);

  useEffect(() => {
    // 여행 상세에서 돌아오며 적어 둔 "이 여행 앞에 세워 달라"는 목록의 몫이다.
    // 여기서 쓰지 않으면 나중에 목록을 열 때 엉뚱하게 그 여행으로 뛴다.
    tripFocus.forget();
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setStatus("guest");
        return;
      }
      const found = await fetchVisitsByName(supabase, data.user.id, name);
      if (!active) return;
      if (!found) {
        setStatus("failed");
        return;
      }
      setVisits(found);
      setStatus("ready");

      const shots = await fetchPlacePhotos(supabase, data.user.id, found.map((visit) => visit.id));
      if (!active) return;
      setPhotos(shots);
      const small = await thumbUrls(supabase, shots.map((shot) => shot.storagePath));
      if (active) setUrls(small);
    });
    return () => {
      active = false;
    };
  }, [name]);

  const byVisit = useMemo(() => {
    const grouped = new Map<string, PlacePhoto[]>();
    for (const shot of photos) grouped.set(shot.visitId, [...(grouped.get(shot.visitId) ?? []), shot]);
    return grouped;
  }, [photos]);
  /** 크게 볼 때 넘겨 가는 차례 — 화면에 놓인 차례 그대로. */
  const ordered = useMemo(() => visits.flatMap((visit) => byVisit.get(visit.id) ?? []), [visits, byVisit]);

  const open = async (index: number) => {
    setViewing(index);
    const path = ordered[index]?.storagePath;
    const supabase = getBrowserClient();
    if (!path || big.has(path) || !supabase) return;
    const url = (await signedUrls(supabase, [path])).get(path);
    if (url) setBig((current) => new Map(current).set(path, url));
  };

  const here = `/places?name=${encodeURIComponent(name)}`;
  const spotId = visits.find((visit) => visit.spotId)?.spotId ?? null;
  const dong = visits.find((visit) => visit.dong)?.dong ?? null;
  const photoTotal = visits.reduce((sum, visit) => sum + visit.photoCount, 0);
  const tripCount = new Set(visits.map((visit) => visit.tripId)).size;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href={LIST_HREF} className="self-start text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 내 여행
      </Link>

      <header className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-bold tracking-tight text-text">{name}</h1>
        {status === "ready" && visits.length > 0 && (
          <>
            <p className="text-[16px] font-semibold text-text">
              {times(tripCount)} 다녀왔어요 · 사진 {photoTotal.toLocaleString("ko-KR")}장
            </p>
            <p className="text-[14px] text-text-muted">
              {visits.length > 1
                ? `처음 ${monthOf(visits.at(-1)!.startedAt)} · 마지막 ${monthOf(visits[0].startedAt)}`
                : monthOf(visits[0].startedAt)}
              {dong && ` · ${dong}`}
            </p>
            {spotId && (
              <Link
                href={`/spots/${spotId}`}
                className="mt-1 self-start rounded-full bg-accent-soft px-3 py-1 text-[13px] font-medium text-accent hover:text-accent-hover"
              >
                한국관광 100선 소개 보기
              </Link>
            )}
          </>
        )}
      </header>

      {status === "loading" && <Waiting title="다녀온 때를 모으고 있어요" />}

      {status === "guest" && (
        <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
          <p className="text-[15px] text-text-muted">로그인하시면 이곳에 다녀온 때를 모아 보여 드려요.</p>
          <Link
            href={`/login?next=${encodeURIComponent(here)}`}
            className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            로그인하기
          </Link>
        </div>
      )}

      {status === "failed" && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[15px] text-text-muted">
          기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {status === "ready" && visits.length === 0 && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[15px] text-text-muted">
          이 이름으로 다녀온 곳이 없어요.
        </p>
      )}

      {status === "ready" && visits.length > 0 && (
        <ol className="flex flex-col">
          {visits.map((visit) => {
            const shots = byVisit.get(visit.id) ?? [];
            const shown = shots.slice(0, PHOTOS_PER_VISIT);
            const more = visit.photoCount - shown.length;
            return (
              <li key={visit.id} className="flex flex-col gap-3 border-t border-line py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[17px] font-semibold tracking-tight text-text">{dayOf(visit.startedAt)}</p>
                  <Link
                    href={`/trips/${visit.tripId}`}
                    // 여행 상세의 "←" 가 이리로 돌아오게.
                    onClick={() => tripFocus.rememberFrom(here)}
                    className="min-w-0 truncate text-[14px] font-medium text-accent hover:text-accent-hover"
                  >
                    {visit.tripTitle ?? "이 여행"} 열기 ›
                  </Link>
                </div>
                {shown.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {shown.map((shot, index) => {
                      const url = urls.get(shot.storagePath);
                      const last = index === shown.length - 1 && more > 0;
                      return (
                        <button
                          key={shot.id}
                          type="button"
                          onClick={() => void open(ordered.indexOf(shot))}
                          aria-label={`${dayOf(visit.startedAt)} 사진 ${index + 1} 크게 보기`}
                          className="relative aspect-square overflow-hidden rounded-xl bg-bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          {url && (
                            // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                          )}
                          {last && (
                            <span className="absolute inset-0 grid place-items-center bg-black/45 text-[16px] font-semibold text-white">
                              +{more}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[14px] text-text-faint">
                    {visit.photoCount > 0 ? `사진 ${visit.photoCount}장 (올리지 않음)` : "사진 없이 기록했어요"}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {status === "ready" && (
        <p className="text-[13px] leading-relaxed text-text-faint">
          이름이 조금이라도 다르면 따로 모여요. 같은 곳인데 여기 없다면, 그 여행의 상세에서 곳 이름을
          이 이름과 똑같이 고쳐 주세요.
        </p>
      )}

      {viewing !== null && ordered[viewing] && (
        <PhotoViewer
          url={big.get(ordered[viewing].storagePath) ?? urls.get(ordered[viewing].storagePath) ?? null}
          index={viewing}
          total={ordered.length}
          onClose={() => setViewing(null)}
          onPrev={() => void open((viewing - 1 + ordered.length) % ordered.length)}
          onNext={() => void open((viewing + 1) % ordered.length)}
        />
      )}
    </main>
  );
}
