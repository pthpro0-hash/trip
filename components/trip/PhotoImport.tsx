"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchSavedRanges, overlapsSaved, saveTrip, tripRange, type DateRange } from "@/lib/supabase/trips";
import { uploadPhotos, type UploadTarget } from "@/lib/supabase/photos";
import { readShots, type ReadResult } from "@/lib/photo/readShots";
import {
  canMerge,
  dayBoundaries,
  dayKey,
  findLivingArea,
  groupIntoTrips,
  mergeAdjacentVisits,
  mergeTrips,
  splitTripAtDay,
  tripDays,
} from "@/lib/photo/grouping";
import { remainingText } from "@/lib/photo/eta";
import { buildTripTitle } from "@/lib/photo/tripTitle";
import type { Shot, Trip } from "@/lib/photo/types";

interface PlaceAnswer {
  title: string;
  isCuratedSpot: boolean;
  spotId: string | null;
  dong: string | null;
}

interface SaveOutcome {
  saved: number;
  skipped: number;
  failed: number;
  photos: number;
  unsupported: string[];
  overLimit: number;
}

interface Stage {
  name: "idle" | "reading" | "naming" | "ready" | "failed";
  done?: number;
  total?: number;
  message?: string;
}

const PLACE_BATCH = 25;

/** 좌표를 캐시 열쇠로. 100m 남짓이면 같은 곳으로 본다. */
const placeKey = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;

/*
  여행을 가리키는 열쇠로 목록 번호가 아니라 첫 사진의 id 를 쓴다.

  번호로 매달면 여행 하나를 나누는 순간 뒤 번호가 전부 밀려, 적어 둔 제목과
  동행자가 옆 여행에 가 붙는다. 첫 사진은 나누어도 앞쪽에 그대로 남으므로
  앞 조각은 적어 둔 것을 지키고, 새로 갈라져 나온 뒤 조각만 새 이름을 받는다.
  도로 합치면 처음 적은 제목이 되살아난다.
*/
const tripKey = (trip: Trip) => trip.shots[0].id;

function hourMinute(date: Date) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** 아직 모르는 좌표만 물어보고 캐시에 더한다. */
async function lookupPlaces(
  trips: Trip[],
  known: Map<string, PlaceAnswer>,
): Promise<Map<string, PlaceAnswer>> {
  const wanted = new Map<string, { lat: number; lng: number }>();
  for (const visit of trips.flatMap((trip) => trip.visits)) {
    const { lat, lng } = visit.shots[0];
    const key = placeKey(lat, lng);
    if (!known.has(key)) wanted.set(key, { lat, lng });
  }

  const next = new Map(known);
  const points = [...wanted.values()];
  const keys = [...wanted.keys()];

  for (let start = 0; start < points.length; start += PLACE_BATCH) {
    const slice = points.slice(start, start + PLACE_BATCH);
    const response = await fetch("/api/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: slice }),
    });
    if (!response.ok) throw new Error("place lookup failed");
    const body: { places: PlaceAnswer[] } = await response.json();
    body.places.forEach((place, i) => next.set(keys[start + i], place));
  }
  return next;
}

export function PhotoImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  // 사진을 올릴 때 원본 파일이 다시 필요하다. 읽을 때 이름으로 찾아 둔다.
  const filesRef = useRef<Map<string, File>>(new Map());
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [read, setRead] = useState<ReadResult | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  // 좌표로 찾는 장소 이름. 나누기·합치기로 방문이 다시 잡혀도 이름은 따라온다.
  const [placeCache, setPlaceCache] = useState<Map<string, PlaceAnswer>>(new Map());
  const [dailyShots, setDailyShots] = useState<Shot[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [companions, setCompanions] = useState<Record<string, string>>({});
  // 제목을 손댄 여행만 기억한다. 손대지 않은 것은 장소에서 새로 짓는다.
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [savedRanges, setSavedRanges] = useState<DateRange[]>([]);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [withPhotos, setWithPhotos] = useState(true);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      setUserId(data.user.id);
      // 같은 사진을 두 번 넣는 일이 잦다. 이미 저장한 날짜를 미리 알아 둔다.
      setSavedRanges(await fetchSavedRanges(supabase, data.user.id));
    });

    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(
    () =>
      trips
        .map((trip, index) => ({ trip, index, key: tripKey(trip) }))
        .filter(({ key }) => !dismissed.has(key)),
    [trips, dismissed],
  );

  // 이미 저장한 날짜는 건너뛴다. 버튼에도 실제로 기록될 건수를 적어야
  // "3건 기록하기"를 눌렀는데 아무것도 안 늘어나는 일이 없다.
  const unsavedCount = useMemo(
    () => visible.filter(({ trip }) => !overlapsSaved(tripRange(trip), savedRanges)).length,
    [visible, savedRanges],
  );

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setDismissed(new Set());
    setOutcome(null);
    setCompanions({});
    setTitles({});
    setUploadNote(null);
    filesRef.current = new Map(files.map((file) => [file.name, file]));
    setStage({ name: "reading", done: 0, total: files.length });

    const result = await readShots(files, (done, total) =>
      setStage({ name: "reading", done, total }),
    );
    setRead(result);

    // 집·직장처럼 여러 날에 걸쳐 되풀이되는 곳은 여행이 아니다.
    const living = findLivingArea(result.shots);
    const daily = living?.shots ?? [];
    const travelShots = result.shots.filter((shot) => !daily.includes(shot));
    setDailyShots(daily);

    const grouped = groupIntoTrips(travelShots);
    setTrips(grouped);

    if (grouped.length === 0) {
      setStage({ name: "ready" });
      return;
    }

    setStage({ name: "naming" });
    try {
      setPlaceCache(await lookupPlaces(grouped, new Map()));
      setStage({ name: "ready" });
    } catch {
      // 이름을 못 붙여도 언제 어디를 몇 장 찍었는지는 보여줄 수 있다.
      setPlaceCache(new Map());
      setStage({ name: "ready", message: "장소 이름을 가져오지 못했어요. 날짜와 사진은 그대로예요." });
    }
  };

  /*
    나누거나 합치면 방문이 다시 잡히고, 전에 없던 좌표가 생길 수 있다.
    모르는 좌표만 물어보고 나머지는 캐시를 그대로 쓴다.
  */
  const reshape = async (next: Trip[]) => {
    setTrips(next);
    const unknown = next
      .flatMap((trip) => trip.visits)
      .filter((visit) => !placeCache.has(placeKey(visit.shots[0].lat, visit.shots[0].lng)));
    if (unknown.length === 0) return;
    try {
      setPlaceCache(await lookupPlaces(next, placeCache));
    } catch {
      // 이름을 못 가져와도 나누기 자체는 이미 끝났다.
    }
  };

  /** 하루가 비고 멀리 떨어진 자리에서 여행을 둘로 가른다. */
  const split = (index: number, day: string) => {
    const parts = splitTripAtDay(trips[index], day);
    if (!parts) return;
    void reshape([...trips.slice(0, index), ...parts, ...trips.slice(index + 1)]);
  };

  /** 앞뒤로 이웃한 두 여행을 하나로 되돌린다. */
  const merge = (first: number, second: number) => {
    const merged = mergeTrips(trips[first], trips[second]);
    void reshape(
      trips.map((trip, i) => (i === first ? merged : trip)).filter((_, i) => i !== second),
    );
  };

  const save = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;

    setSaving(true);
    const result: SaveOutcome = {
      saved: 0,
      skipped: 0,
      failed: 0,
      photos: 0,
      unsupported: [],
      overLimit: 0,
    };

    for (const { trip, key } of visible) {
      // 같은 날짜의 여행이 이미 있으면 건너뛴다. 사진을 두 번 넣어도
      // 같은 여행이 두 건으로 남지 않는다.
      if (overlapsSaved(tripRange(trip), savedRanges)) {
        result.skipped += 1;
        continue;
      }
      // 같은 곳이 연달아 나오는 것은 합쳐서 저장한다. 보이는 대로 남는다.
      const shaped = shapeOf(trip);
      const toSave: Trip = { shots: trip.shots, visits: shaped.visits };
      const visitPlaces = shaped.visits.map((visit, visitIndex) => {
        const place = placeOf(visit);
        return {
          title: shaped.labels[visitIndex] || place?.title || "알 수 없는 곳",
          spotId: place?.spotId ?? null,
          dong: place?.dong ?? null,
        };
      });
      const saved = await saveTrip(
        supabase,
        userId,
        toSave,
        visitPlaces,
        companions[key] ?? "",
        titleOf(trip),
      );
      if (!saved.ok) {
        result.failed += 1;
        continue;
      }

      result.saved += 1;
      savedRanges.push(tripRange(trip));

      if (!withPhotos || !saved.visitIds) continue;

      const targets: UploadTarget[] = [];
      shaped.visits.forEach((visit, visitIndex) => {
        const visitId = saved.visitIds![visitIndex];
        if (!visitId) return;
        visit.shots.forEach((shot, shotIndex) => {
          const file = filesRef.current.get(shot.id);
          if (!file) return;
          targets.push({
            visitId,
            file,
            takenAt: shot.takenAt,
            lat: shot.lat,
            lng: shot.lng,
            // 여행마다 첫 장을 대표로 둔다.
            isCover: visitIndex === 0 && shotIndex === 0,
          });
        });
      });

      // 남은 시간은 실제로 걸린 시간에서 어림한다. 망 사정이 사람마다 다르다.
      const uploaded = await uploadPhotos(supabase, userId, targets, (done, total, elapsed) => {
        const left = remainingText(done, total, elapsed);
        setUploadNote(`사진 올리는 중… ${done}/${total}${left ? ` · ${left}` : ""}`);
      });
      result.photos += uploaded.uploaded;
      result.unsupported.push(...uploaded.unsupported);
      result.overLimit += uploaded.overLimit;
    }
    setUploadNote(null);

    setSavedRanges([...savedRanges]);
    setOutcome(result);
    setSaving(false);
  };

  const placeOf = (visit: { shots: { lat: number; lng: number }[] }) =>
    placeCache.get(placeKey(visit.shots[0].lat, visit.shots[0].lng));

  /** 같은 이름이 연달아 나오는 방문을 합쳐, 보여주고 저장할 모양으로. */
  const shapeOf = (trip: Trip) => {
    const labels = trip.visits.map((visit) => placeOf(visit)?.title ?? "");
    return mergeAdjacentVisits(trip.visits, labels);
  };

  const titleOf = (trip: Trip) => {
    const mine = titles[tripKey(trip)];
    if (mine !== undefined) return mine;
    const { visits, labels } = shapeOf(trip);
    return buildTripTitle(
      labels.map((label, i) => ({ label, photoCount: visits[i].shots.length })),
    );
  };

  if (stage.name === "reading" || stage.name === "naming") {
    return (
      <div className="rounded-2xl bg-bg-subtle p-8 text-center">
        <p className="text-[17px] font-medium text-text">
          {stage.name === "reading" ? "사진을 읽고 있어요" : "장소를 찾고 있어요"}
        </p>
        {stage.name === "reading" && (
          <p className="mt-2 text-[15px] text-text-muted">
            {stage.done}장 / {stage.total}장
          </p>
        )}
        <p className="mt-3 text-[13px] text-text-faint">사진은 아직 어디로도 올라가지 않았어요.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[15px] leading-relaxed text-text-muted">
          사진을 고르면 언제 어디서 찍었는지 읽어 여행으로 묶어 드려요.
          <br />
          <span className="text-text-faint">
            읽기는 이 브라우저 안에서만 일어나고, 사진은 올라가지 않아요.
          </span>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => void handleFiles([...(event.target.files ?? [])])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          사진 고르기
        </button>
      </div>

      {stage.message && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          {stage.message}
        </p>
      )}

      {read && (
        <p className="text-[13px] text-text-faint">
          사진 {read.shots.length + read.withoutLocation.length}장
          {read.screenshots.length > 0 && ` · 화면 캡처 ${read.screenshots.length}장 제외`}
          {dailyShots.length > 0 && ` · 일상 ${dailyShots.length}장 제외`}
          {read.withoutLocation.length > 0 && ` · 위치 없음 ${read.withoutLocation.length}장`}
          {read.unreadable.length > 0 && ` · 읽지 못함 ${read.unreadable.length}개`}
        </p>
      )}

      {stage.name === "ready" && trips.length === 0 && read && (
        <div className="rounded-2xl bg-bg-subtle p-6 text-[15px] text-text-muted">
          여행으로 묶을 만한 사진을 찾지 못했어요. 촬영 위치가 들어 있는 사진이 필요해요.
        </div>
      )}

      {visible.length > 0 && (
        <p className="text-[15px] font-medium text-text">여행 {visible.length}건을 찾았어요</p>
      )}

      <ol className="flex flex-col gap-4">
        {visible.map(({ trip, index, key }, position) => {
          const days = tripDays(trip);
          const span = days.length > 1 ? `${days[0]} ~ ${days.at(-1)}` : days[0];
          const shaped = shapeOf(trip);
          const alreadySaved = overlapsSaved(tripRange(trip), savedRanges);
          const editable = Boolean(userId) && !alreadySaved;
          const previous = visible[position - 1];
          // 멀리 떨어진 날 경계만 묻는다. 가까운 데서 잔 1박 2일까지 물으면 성가시다.
          const cuts = new Map(
            dayBoundaries(trip)
              .filter((boundary) => boundary.uncertain)
              .map((boundary) => [boundary.day, boundary]),
          );

          return (
            <li key={key} className="flex flex-col gap-4">
              {previous && editable && canMerge(previous.trip, trip) && (
                <button
                  type="button"
                  onClick={() => merge(previous.index, index)}
                  className="self-center rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-line"
                >
                  ↑ 위 여행과 한 여행이었어요
                </button>
              )}

              <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editable ? (
                      <input
                        type="text"
                        value={titleOf(trip)}
                        onChange={(event) => setTitles({ ...titles, [key]: event.target.value })}
                        placeholder="이 여행의 이름"
                        aria-label="여행 제목"
                        className="-mx-2 w-full rounded-lg bg-transparent px-2 py-1 text-[17px] font-semibold tracking-tight text-text outline-none transition placeholder:font-normal placeholder:text-text-faint hover:bg-bg-subtle focus:bg-bg-subtle focus:ring-2 focus:ring-accent"
                      />
                    ) : (
                      <p className="text-[17px] font-semibold tracking-tight text-text">
                        {titleOf(trip) || span}
                      </p>
                    )}
                    <p className="mt-0.5 text-[13px] text-text-faint">
                      {span} · 사진 {trip.shots.length}장 · 방문 {shaped.visits.length}곳
                      {days.length > 1 && ` · ${days.length}일`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissed(new Set(dismissed).add(key))}
                    className="shrink-0 rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-line"
                  >
                    일상이에요
                  </button>
                </div>

                {alreadySaved && (
                  <p className="text-[13px] text-text-faint">이미 기록한 날짜와 겹쳐요.</p>
                )}

                <ul className="flex flex-col gap-2">
                  {shaped.visits.map((visit, visitIndex) => {
                    const place = placeOf(visit);
                    const first = visit.shots[0].takenAt;
                    const last = visit.shots.at(-1)!.takenAt;
                    const before = shaped.visits[visitIndex - 1];
                    const day = dayKey(first);
                    const cut =
                      before && dayKey(before.shots.at(-1)!.takenAt) !== day
                        ? cuts.get(day)
                        : undefined;

                    return (
                      <Fragment key={visitIndex}>
                        {cut && editable && (
                          <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-bg-subtle px-3 py-2 text-[13px] text-text-muted">
                            <span>여기서 날이 바뀌고 {Math.round(cut.km)}km 떨어져요.</span>
                            <button
                              type="button"
                              onClick={() => split(index, cut.day)}
                              className="font-medium text-accent transition hover:text-accent-hover"
                            >
                              따로 기록하기
                            </button>
                          </li>
                        )}
                        <li className="flex items-baseline gap-2 text-[15px]">
                          <span className="text-text-faint">▸</span>
                          <span className="font-medium text-text">
                            {place?.title ?? "장소 확인 중"}
                          </span>
                          {place?.isCuratedSpot && (
                            <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                              100선
                            </span>
                          )}
                          <span className="text-[13px] text-text-faint">
                            {dayKey(first).slice(5)} {hourMinute(first)}
                            {hourMinute(last) !== hourMinute(first) && `~${hourMinute(last)}`} ·{" "}
                            {visit.shots.length}장
                          </span>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>

                {editable && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-medium text-text-faint">누구와 가셨나요?</span>
                    <input
                      type="text"
                      value={companions[key] ?? ""}
                      onChange={(event) =>
                        setCompanions({ ...companions, [key]: event.target.value })
                      }
                      placeholder="예: 가족, 민수, 혼자"
                      className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                    />
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {outcome && (
        <div className="flex flex-col gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent">
          <p className="font-medium">
            {outcome.saved > 0 ? `여행 ${outcome.saved}건을 기록했어요.` : "새로 기록한 여행이 없어요."}
            {outcome.photos > 0 && ` 사진 ${outcome.photos}장을 함께 올렸어요.`}
            {outcome.skipped > 0 && ` 이미 있던 ${outcome.skipped}건은 건너뛰었어요.`}
            {outcome.failed > 0 && ` ${outcome.failed}건은 저장하지 못했어요.`}
          </p>
          {outcome.unsupported.length > 0 && (
            <p className="text-[13px]">
              {outcome.unsupported.length}장은 이 브라우저가 열지 못하는 형식이라 올리지
              못했어요. 기록 자체는 남아 있어요.
            </p>
          )}
          {outcome.overLimit > 0 && (
            <p className="text-[13px]">
              보관할 수 있는 사진 수를 넘어 {outcome.overLimit}장은 올리지 못했어요.
            </p>
          )}
          <Link href="/trips" className="self-start font-medium underline underline-offset-2">
            내 여행 보기 →
          </Link>
        </div>
      )}

      {visible.length > 0 && !userId && (
        <div className="flex flex-col gap-2 rounded-xl bg-bg-subtle px-4 py-3.5 text-[14px] text-text-muted">
          <p>기록으로 남기려면 로그인이 필요해요. 찾은 결과는 로그인한 뒤 다시 골라 주세요.</p>
          <Link
            href="/login?next=%2Ftrips%2Fnew"
            className="self-start font-medium text-accent hover:text-accent-hover"
          >
            로그인하기 →
          </Link>
        </div>
      )}

      {visible.length > 0 && userId && (
        <label className="flex items-start gap-2.5 rounded-xl bg-bg-subtle px-4 py-3">
          <input
            type="checkbox"
            checked={withPhotos}
            onChange={(event) => setWithPhotos(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="text-[14px] leading-relaxed text-text-muted">
            <span className="font-medium text-text">사진도 함께 올리기</span>
            <br />
            <span className="text-[13px] text-text-faint">
              긴 변 2048px로 줄여 올리고 원본은 보관하지 않아요. 끄면 언제 어디를 다녀왔는지만
              기록돼요.
            </span>
          </span>
        </label>
      )}

      {uploadNote && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          {uploadNote}
          <br />
          <span className="text-[13px] text-text-faint">
            다 올라갈 때까지 이 창을 닫지 마세요. 여행 기록은 이미 남았고, 사진만 이어서 올라가요.
          </span>
        </p>
      )}

      {visible.length > 0 && userId && (
        <button
          type="button"
          onClick={save}
          disabled={saving || unsavedCount === 0}
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
        >
          {saving
            ? "기록하는 중…"
            : unsavedCount === 0
              ? "모두 이미 기록했어요"
              : `여행 ${unsavedCount}건 기록하기`}
        </button>
      )}

      {visible.length > 0 && (
        <p className="text-[13px] leading-relaxed text-text-faint">
          제목은 장소에서 지어 둔 것이니 마음에 들면 그대로 두세요. 묶음이 잘못됐다면 제목을
          고치기 전에 나누거나 합쳐 주세요.
        </p>
      )}
    </>
  );
}
