"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { rememberedName, type PlaceMemory } from "@/lib/placeMemory";
import { fetchPlaceNames } from "@/lib/supabase/placeNames";
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
import { logEvent } from "@/lib/supabase/serviceLog";
import { rememberStartIfUnset } from "@/lib/start";
import { canIn, ownerOf, readFamilyView, useFamilyView } from "@/lib/familyView";
import { remainingText } from "@/lib/photo/eta";
import { pickPreviewShots } from "@/lib/photo/preview";
import { spanText } from "@/lib/photo/span";
import { buildTripTitle } from "@/lib/photo/tripTitle";
import { Waiting, WaitingOverlay } from "@/components/layout/Waiting";
import type { Shot, Trip } from "@/lib/photo/types";
import { DoneView } from "./photoImport/DoneView";
import { ImportSteps } from "./photoImport/ImportSteps";
import { SaveBar } from "./photoImport/SaveBar";
import { DismissedTrip, TripCard } from "./photoImport/TripCard";
import type { SaveOutcome, VisitLine } from "./photoImport/types";

/*
  사진으로 여행을 추가하는 길 — 세 걸음이다.

    1 고르기   큰 단추 하나. 사진을 고르면 이 브라우저 안에서 촬영 시각과 위치를 읽는다.
    2 확인     찾은 여행을 카드로 보여 준다(제목 · 기간 · 작은 그림). 곳 목록 · 동행 · 나누기 · 합치기는
               "다듬기" 안에 접는다. 아래에는 기록 막대가 붙는다.
    3 기록     끝났다고 말하고, 결과를 볼 곳 둘(지도 · 한장 요약)을 건넨다.

  이 컴포넌트는 상태와 저장을 들고, 화면 조각은 photoImport/ 에 있다.
*/

interface PlaceAnswer {
  title: string;
  isCuratedSpot: boolean;
  spotId: string | null;
  dong: string | null;
}

interface Stage {
  name: "idle" | "reading" | "naming" | "ready" | "failed";
  done?: number;
  total?: number;
  message?: string;
}

/** 여행 하나와 그것을 가리키는 열쇠 · 목록에서의 자리. */
interface Row {
  trip: Trip;
  index: number;
  key: string;
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
  // 고른 파일을 이름으로 찾아 둔다. 사진을 올릴 때 원본이 다시 필요하고, 카드의 작은 그림도 이것으로 만든다.
  const [picked, setPicked] = useState<Map<string, File>>(new Map());
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [read, setRead] = useState<ReadResult | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  // 좌표로 찾는 장소 이름. 나누기·합치기로 방문이 다시 잡혀도 이름은 따라온다.
  const [placeCache, setPlaceCache] = useState<Map<string, PlaceAnswer>>(new Map());
  const [dailyShots, setDailyShots] = useState<Shot[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  /*
    로그인 여부를 알아보았는가. 알기 전에는 "로그인하고 기록하기"를 내밀지 않는다 — 이미 로그인한 사람이
    사진을 읽는 몇 초 사이에 그 단추를 잠깐 보게 된다.
  */
  const [authChecked, setAuthChecked] = useState(false);
  /*
    가족의 여행을 보는 중이면 사진은 그 사람의 여행에 더해진다(userId 는 자료의 주인).
    더할 권한이 없으면 저장할 수 없다 — 올리는 곳이 남의 여행이라 안내만 한다.
  */
  const family = useFamilyView();
  const noAdd = family !== null && !canIn(family, "add");
  const [companions, setCompanions] = useState<Record<string, string>>({});
  // 제목을 손댄 여행만 기억한다. 손대지 않은 것은 장소에서 새로 짓는다.
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [savedRanges, setSavedRanges] = useState<DateRange[]>([]);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [withPhotos, setWithPhotos] = useState(true);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  /*
    고르기 창을 닫은 뒤, 브라우저가 파일 목록을 건네줄 때까지의 틈.

    onChange 는 그 목록이 다 만들어진 다음에야 온다. 삼백 장이면 그 사이가
    몇 초다. 그동안 화면이 그대로면 사람은 안 눌렸다고 생각하고 다시 누른다.
  */
  const [picking, setPicking] = useState(false);
  /** 전에 고쳐 둔 곳 이름. 같은 자리면 지도 서비스의 이름보다 먼저 붙인다. */
  const [memories, setMemories] = useState<PlaceMemory[]>([]);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!active) return;
        const viewed = readFamilyView();
        // 로그인 전이거나 가족 여행에 더할 권한이 없으면 저장할 곳이 없다. 사용자 id 를 비워 두어 저장 길이 열리지 않게 한다.
        if (!data.user || (viewed && !canIn(viewed, "add"))) {
          setAuthChecked(true);
          return;
        }
        const owner = ownerOf(viewed, data.user.id);
        setUserId(owner);
        setAuthChecked(true);
        // 같은 사진을 두 번 넣는 일이 잦다. 이미 저장한 날짜를 미리 알아 둔다.
        setSavedRanges(await fetchSavedRanges(supabase, owner));
        const remembered = await fetchPlaceNames(supabase, owner);
        if (active) setMemories(remembered);
      })
      .catch(() => {
        // 알아보지 못했다. 로그인 길을 열어 둔다 — 이미 로그인했으면 로그인 화면이 이 화면으로 돌려보낸다.
        if (active) setAuthChecked(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<Row[]>(
    () => trips.map((trip, index) => ({ trip, index, key: tripKey(trip) })),
    [trips],
  );

  const visible = useMemo(() => rows.filter(({ key }) => !dismissed.has(key)), [rows, dismissed]);

  // 이미 저장한 날짜는 건너뛴다. 버튼에도 실제로 기록될 건수를 적어야
  // "3건 기록하기"를 눌렀는데 아무것도 안 늘어나는 일이 없다.
  const unsavedCount = useMemo(
    () => visible.filter(({ trip }) => !overlapsSaved(tripRange(trip), savedRanges)).length,
    [visible, savedRanges],
  );

  // 각 여행 바로 위에 보이는 여행. 뺀 여행은 건너뛴다 — 합칠 수 있는지는 눈에 보이는 이웃과 따진다.
  const aboveOf = useMemo(() => {
    const above = new Map<string, Row>();
    let last: Row | undefined;
    for (const row of visible) {
      if (last) above.set(row.key, last);
      last = row;
    }
    return above;
  }, [visible]);

  /*
    고르기 창을 연다.

    창이 닫히는 순간은 창에 초점이 돌아오는 것으로 안다 — 그 뒤부터가
    브라우저가 파일을 모으는 시간이라, 안내는 그때부터 내민다. 창이 떠
    있는 동안 뒤에서 "불러오는 중"이라 적어 두면 거짓말이다.
  */
  const pick = () => {
    const input = inputRef.current;
    if (!input) return;
    // 같은 사진을 다시 골라도 onChange 가 오도록 비워 둔다.
    input.value = "";
    input.click();

    const onBack = () => {
      window.removeEventListener("focus", onBack);
      setPicking(true);
    };
    window.addEventListener("focus", onBack);
  };

  /*
    고르지 않고 창을 닫으면 cancel 이 온다. 이 행사를 모르는 브라우저를
    위해 시간 제한도 함께 둔다 — "불러오는 중"이 영영 남아 있지 않게.

    cancel 은 React 가 아는 이름이 아니라 직접 매단다.
  */
  useEffect(() => {
    if (!picking) return;
    const input = inputRef.current;
    const give = () => setPicking(false);
    input?.addEventListener("cancel", give);
    const id = setTimeout(give, 60_000);
    return () => {
      input?.removeEventListener("cancel", give);
      clearTimeout(id);
    };
  }, [picking]);

  const handleFiles = async (files: File[]) => {
    setPicking(false);
    if (files.length === 0) return;
    setDismissed(new Set());
    setOutcome(null);
    setCompanions({});
    setTitles({});
    setUploadNote(null);
    setPicked(new Map(files.map((file) => [file.name, file])));
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

    // 무엇이 걸러졌는지가 곧 무엇이 안 되는지다. 수만 남긴다.
    logEvent(getBrowserClient(), "photos_read", {
      picked: files.length,
      usable: result.shots.length,
      daily: daily.length,
      noLocation: result.withoutLocation.length,
      screenshots: result.screenshots.length,
      unreadable: result.unreadable.length,
      trips: grouped.length,
    });

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
    logEvent(getBrowserClient(), "trip_reshaped", { split: true });
    void reshape([...trips.slice(0, index), ...parts, ...trips.slice(index + 1)]);
  };

  /** 앞뒤로 이웃한 두 여행을 하나로 되돌린다. */
  const merge = (first: number, second: number) => {
    logEvent(getBrowserClient(), "trip_reshaped", { split: false });
    const merged = mergeTrips(trips[first], trips[second]);
    void reshape(
      trips.map((trip, i) => (i === first ? merged : trip)).filter((_, i) => i !== second),
    );
  };

  /** 여행이 아니라고 뺀다. 눌러서 잃은 것을 되찾을 길이 있다(undismiss). */
  const dismiss = (key: string) => setDismissed(new Set(dismissed).add(key));
  const undismiss = (key: string) => {
    const next = new Set(dismissed);
    next.delete(key);
    setDismissed(next);
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
          const file = picked.get(shot.id);
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
      // 걸린 시간은 올리는 쪽이 알려 준다. 화면이 시계를 들 일이 아니다.
      let elapsedMs = 0;
      const uploaded = await uploadPhotos(supabase, userId, targets, (done, total, elapsed) => {
        elapsedMs = elapsed;
        const left = remainingText(done, total, elapsed);
        setUploadNote(`${done}장 / ${total}장${left ? ` · ${left}` : ""}`);
      });
      result.photos += uploaded.uploaded;
      result.unsupported.push(...uploaded.unsupported);
      result.overLimit += uploaded.overLimit;

      logEvent(supabase, "photos_uploaded", {
        tried: targets.length,
        uploaded: uploaded.uploaded,
        // 아이폰 HEIC 가 여기로 온다. 이 수가 곧 남은 숙제의 크기다.
        unsupported: uploaded.unsupported.length,
        failed: uploaded.failed,
        overLimit: uploaded.overLimit,
        seconds: Math.round(elapsedMs / 1000),
      });
    }
    setUploadNote(null);

    logEvent(supabase, "trips_saved", {
      saved: result.saved,
      skipped: result.skipped,
      failed: result.failed,
      withPhotos,
    });

    /*
      여행을 기록한 사람은 다음부터 내 여행으로 열려야 한다 — 이 사람에게 첫 화면의
      여행 100선은 문 앞에서 한 번 돌아가는 일이다. 갈래를 눌러서 고른 사람의
      선택은 뒤집지 않는다. 하나도 못 기록했으면 기억할 것도 없다.
    */
    if (result.saved > 0) rememberStartIfUnset("sketch");

    setSavedRanges([...savedRanges]);
    setOutcome(result);
    setSaving(false);
  };

  /*
    이 방문의 곳. 전에 이 자리 이름을 고쳐 두었으면 그 이름이 먼저다 —
    같은 곳을 매번 다시 고치게 하지 않는다(lib/placeMemory).
  */
  const placeOf = (visit: { shots: { lat: number; lng: number }[] }): PlaceAnswer | undefined => {
    const { lat, lng } = visit.shots[0];
    const place = placeCache.get(placeKey(lat, lng));
    const memory = rememberedName(memories, lat, lng);
    if (!memory) return place;
    return { isCuratedSpot: false, spotId: null, dong: null, ...place, title: memory.name };
  };

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

  /** 카드의 "들른 곳" 줄들. 멀리 떨어진 날 경계에는 나누기 자리가 붙는다. */
  const visitLinesOf = (trip: Trip, shaped: ReturnType<typeof shapeOf>): VisitLine[] => {
    // 멀리 떨어진 날 경계만 묻는다. 가까운 데서 잔 1박 2일까지 물으면 성가시다.
    const cuts = new Map(
      dayBoundaries(trip)
        .filter((boundary) => boundary.uncertain)
        .map((boundary) => [boundary.day, boundary]),
    );
    return shaped.visits.map((visit, visitIndex) => {
      const place = placeOf(visit);
      const first = visit.shots[0].takenAt;
      const last = visit.shots.at(-1)!.takenAt;
      const before = shaped.visits[visitIndex - 1];
      const day = dayKey(first);
      const cut =
        before && dayKey(before.shots.at(-1)!.takenAt) !== day ? cuts.get(day) : undefined;
      return {
        id: visitIndex,
        title: place?.title ?? "장소 확인 중",
        curated: Boolean(place?.isCuratedSpot),
        when: `${day.slice(5)} ${hourMinute(first)}${
          hourMinute(last) !== hourMinute(first) ? `~${hourMinute(last)}` : ""
        } · ${visit.shots.length}장`,
        cut: cut ? { day: cut.day, km: cut.km } : undefined,
      };
    });
  };

  const renderRow = ({ trip, index, key }: Row) => {
    const days = tripDays(trip);
    const span = spanText(days);

    if (dismissed.has(key)) {
      return <DismissedTrip title={titleOf(trip) || span} onUndo={() => undismiss(key)} />;
    }

    const shaped = shapeOf(trip);
    const alreadySaved = overlapsSaved(tripRange(trip), savedRanges);
    const editable = Boolean(userId) && !alreadySaved;
    const above = aboveOf.get(key);

    return (
      <TripCard
        title={titleOf(trip)}
        onTitle={(next) => setTitles({ ...titles, [key]: next })}
        span={span}
        photos={trip.shots.length}
        places={shaped.visits.length}
        files={pickPreviewShots(trip.shots)
          .map((shot) => picked.get(shot.id))
          .filter((file): file is File => Boolean(file))}
        visits={visitLinesOf(trip, shaped)}
        companions={companions[key] ?? ""}
        onCompanions={(next) => setCompanions({ ...companions, [key]: next })}
        editable={editable}
        alreadySaved={alreadySaved}
        canMergeUp={editable && above !== undefined && canMerge(above.trip, trip)}
        onMergeUp={() => above && merge(above.index, index)}
        onSplit={(day) => split(index, day)}
        onDismiss={() => dismiss(key)}
      />
    );
  };

  /** 사진을 더 고른다 — 처음 화면으로 돌아가 곧바로 고르는 창을 연다(누른 바로 그 순간이어야 창이 열린다). */
  const more = () => {
    setOutcome(null);
    setTrips([]);
    setRead(null);
    setDailyShots([]);
    setStage({ name: "idle" });
    setPicked(new Map());
    setDismissed(new Set());
    setCompanions({});
    setTitles({});
    setUploadNote(null);
    pick();
  };

  /*
    고르는 칸은 화면이 어떻게 바뀌어도 늘 같은 자리에 둔다.

    고르기 창이 닫히면 화면이 "불러오는 중"으로 바뀌는데, 그때 칸까지
    사라지면 아무것도 고르지 않고 닫았다는 소식(cancel)이 올 데가 없어
    안내가 그대로 얼어붙는다. 자리가 바뀌어도 React 가 새로 만들므로,
    어느 갈래로 가든 맨 앞에 놓는다.
  */
  const picker = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={(event) => void handleFiles([...(event.target.files ?? [])])}
    />
  );

  if (picking) {
    return (
      <>
        {picker}
        <ImportSteps current={1} />
        <Waiting
          title="고르신 사진을 불러오고 있어요"
          note="사진이 많으면 여기서 조금 걸려요. 사진은 아직 어디로도 올라가지 않았어요."
        />
      </>
    );
  }

  if (stage.name === "reading" || stage.name === "naming") {
    return (
      <>
        {picker}
        <ImportSteps current={1} />
        <Waiting
          title={stage.name === "reading" ? "사진을 읽고 있어요" : "장소를 찾고 있어요"}
          detail={stage.name === "reading" ? `${stage.done}장 / ${stage.total}장` : undefined}
          note="사진은 아직 어디로도 올라가지 않았어요."
        />
      </>
    );
  }

  if (outcome) {
    return (
      <>
        {picker}
        <ImportSteps current={3} />
        <DoneView outcome={outcome} onMore={more} onRetry={() => setOutcome(null)} />
      </>
    );
  }

  const hasTrips = trips.length > 0;
  // 로그인 전이다. 알아보기 전에는 모른다고 본다.
  const signedOut = authChecked && !userId && !noAdd;

  /** 읽은 사진이 어떻게 갈렸는지. 무엇이 빠졌는지 알아야 "내 사진이 왜 없지?" 하지 않는다. */
  const readSummary = read && (
    <p className="text-[13px] text-text-faint">
      사진 {read.shots.length + read.withoutLocation.length}장
      {read.screenshots.length > 0 && ` · 화면 캡처 ${read.screenshots.length}장 제외`}
      {dailyShots.length > 0 && ` · 일상 ${dailyShots.length}장 제외`}
      {read.withoutLocation.length > 0 && ` · 위치 없음 ${read.withoutLocation.length}장`}
      {read.unreadable.length > 0 && ` · 읽지 못함 ${read.unreadable.length}개`}
    </p>
  );

  if (!hasTrips) {
    return (
      <>
        {picker}
        <ImportSteps current={1} />

        <div className="flex flex-col gap-4 rounded-2xl bg-bg-subtle p-6">
          <p className="break-keep text-[15px] leading-relaxed text-text-muted">
            사진을 고르면 언제 어디서 찍었는지 읽어 여행으로 묶어 드려요.
          </p>
          <button
            type="button"
            onClick={pick}
            className="w-full rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition hover:bg-accent-hover"
          >
            사진 고르기
          </button>
          {/*
            약속은 정확해야 한다: 고르는 동안(읽는 동안)은 사진이 기기 밖으로 나가지 않지만, 기록할 때
            "사진도 함께 올리기"를 고르면 올라간다. "올라가지 않아요"라고 하면 틀린 약속이 된다.
          */}
          <div className="flex items-start gap-1.5 break-keep text-[13px] leading-snug text-text-muted">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="mt-px h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <p>
              <span className="block">고르는 동안 사진은 이 기기 밖으로 나가지 않아요</span>
              {signedOut && <span className="block text-text-faint">기록으로 남길 때 로그인해요</span>}
            </p>
          </div>
        </div>

        {readSummary}

        {stage.name === "ready" && read && (
          <div className="break-keep rounded-2xl bg-bg-subtle p-6 text-[15px] text-text-muted">
            여행으로 묶을 만한 사진을 찾지 못했어요. 촬영 위치가 들어 있는 사진이 필요해요.
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {picker}
      <ImportSteps current={2} />

      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold text-text">
          {visible.length > 0 ? `여행 ${visible.length}건을 찾았어요` : "여행을 모두 뺐어요"}
        </h2>
        <button
          type="button"
          onClick={pick}
          className="shrink-0 text-[13px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text"
        >
          사진 다시 고르기
        </button>
      </div>

      {readSummary}

      {stage.message && (
        <p className="break-keep rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">{stage.message}</p>
      )}

      {noAdd && (
        <p className="break-keep rounded-xl bg-bg-subtle px-4 py-3.5 text-[14px] text-text-muted">
          {family?.label} 님의 여행에는 사진을 더할 수 없어요(권한이 &lsquo;추가도 가능&rsquo;이 아니에요). 내
          여행으로 돌아가 올려 주세요.
        </p>
      )}

      {family !== null && userId && (
        <p className="break-keep rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-text">
          이 사진은 <span className="font-semibold">{family.label}</span> 님의 여행에 더해져요.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.key}>{renderRow(row)}</li>
        ))}
      </ol>

      {/*
        기록하는 동안은 화면을 덮는다. 알리려는 것보다 막으려는 것이 크다 —
        올리는 중에 다시 누르면 같은 사진이 두 번 올라가고, 자리를 뜨면
        절반만 올라간 채로 끝난다.
      */}
      {saving && (
        <WaitingOverlay
          title={uploadNote ? "사진을 올리고 있어요" : "여행을 기록하고 있어요"}
          detail={uploadNote ?? undefined}
          note={
            uploadNote
              ? "다 올라갈 때까지 이 창을 닫지 마세요. 여행 기록은 이미 남았고, 사진만 이어서 올라가요."
              : undefined
          }
        />
      )}

      {visible.length > 0 && !noAdd && authChecked && (
        <SaveBar
          mode={signedOut ? "login" : "save"}
          count={unsavedCount}
          saving={saving}
          withPhotos={withPhotos}
          onWithPhotos={setWithPhotos}
          onSave={save}
        />
      )}
    </>
  );
}
