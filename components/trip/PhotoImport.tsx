"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { rememberedName, type PlaceMemory } from "@/lib/placeMemory";
import { fetchPlaceNames } from "@/lib/supabase/placeNames";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchSavedRanges, overlapsSaved, saveTrip, tripRange, type DateRange } from "@/lib/supabase/trips";
import { addToExistingTrip } from "@/lib/supabase/tripAdd";
import { uploadPhotos, uploadPrepared, type PreparedTarget, type UploadTarget } from "@/lib/supabase/photos";
import { readShots, type ReadResult } from "@/lib/photo/readShots";
import { canPrepare, prepareForLogin } from "@/lib/photo/prepare";
import { clearStash, loadStashedPhoto, probeStash, readStash, type StashMeta } from "@/lib/photo/stash";
import { fromStashed, shotsOf, toStashed } from "@/lib/photo/stashTrips";
import { goTo } from "@/lib/goTo";
import { launchOpened, subscribeLaunch, takePendingFiles } from "@/lib/photo/launch";
import { RESUME_LOGIN_HREF, resumeRequested } from "@/lib/photo/resume";
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

  로그인 전이어도 여기까지는 같다. 기록하려면 로그인해야 하는데 로그인은 카카오 같은 곳으로 갔다 오는 길이라 화면이 새로 열린다.
  그래서 [로그인하고 기록하기]를 누르면 떠나기 전에 올릴 크기로 줄인 사진과 찾은 여행을 이 브라우저에 맡겨 두고(lib/photo/stash),
  로그인하고 돌아오면 그 자리에서 이어 기록한다 — 사진을 처음부터 다시 고르지 않는다. 맡아 둘 수 없는 브라우저는 예전 길 그대로다.

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
/** 맡겨 둔 지 이 안이면 '방금', 넘으면 '전에' 고른 여행이라고 말한다(맡겨 둔 것은 여섯 시간까지 남는다). */
const RECENT_MS = 60 * 60 * 1000;
/** 맡겨 둔 사진에서 카드의 작은 그림을 꺼낼 때 이만큼 모아서 화면에 반영한다(한 장마다 다시 그리지 않게). */
const PREVIEW_FLUSH = 6;
/** 돌아왔다고 해 놓고 맡겨 둔 것을 읽지 못하는 채로 기다리는 화면을 이보다 오래 두지 않는다. */
const RESUME_WAIT_MS = 10_000;
/** 주소는 우리가 바꾸지 않는 한 바뀌지 않는다 — 구독할 것이 없다. */
const noSubscribe = () => () => undefined;

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

  /*
    로그인 전: 로그인하러 떠나기 전에 사진을 이 브라우저에 맡겨 둘 수 있는가(lib/photo/stash). 맡아 둘 수 있어야
    "로그인한 뒤 그대로 이어서 기록해요"라고 말할 수 있다. 아니면 예전 길 — 같은 사진을 한 번 더 고르게 한다.
  */
  const [canStash, setCanStash] = useState(false);
  // 맡아 두려다 못 했다. 그다음부터는 새로 고르기 전까지 예전 길로 둔다.
  const [stashFailed, setStashFailed] = useState(false);
  // 로그인하러 떠나려고 사진을 준비하는 중(몇 장째인지).
  const [preparing, setPreparing] = useState<{ done: number; total: number; elapsedMs: number } | null>(null);
  /*
    로그인하기 전에 맡겨 둔 여행으로 열린 화면이면 그 맡겨 둔 것(recent: 맡긴 지 얼마 안 됐는가).
    이때 사진은 고른 파일이 아니라 맡겨 둔 사진이다 — 이미 올릴 크기로 줄여 두었고, 기록은 그것을 올린다.
  */
  const [restored, setRestored] = useState<{ meta: StashMeta; recent: boolean } | null>(null);
  // 누른 단추를 또 눌러도 한 번만 준비한다(상태는 다시 그리기 전까지 옛 값이라 ref).
  const preparingRef = useRef(false);
  const aliveRef = useRef(true);
  /*
    사람이 화면을 새로 시작한 횟수(사진을 고름 · 버림 · 더 고르기). 0 이면 아직 아무 손도 대지 않은 것이다. 맡겨 둔 여행은 0 일
    때만 연다 — 읽어 오는 동안 사람이 먼저 사진을 골랐으면, 늦게 온 맡겨 둔 것이 그 위를 덮지 않는다.
  */
  const epochRef = useRef(0);
  // 맡겨 둔 사진에서 작은 그림을 이미 꺼내 본 것(못 꺼낸 것도 다시 시도하지 않는다).
  const triedPreviews = useRef(new Set<string>());
  /*
    로그인하러 갔다 돌아왔다는 표시(?resume=1)가 주소에 있는가(lib/photo/resume). 있어야 맡겨 둔 여행을 되살린다 — 같은 브라우저에서
    다른 사람이 로그인해 이 화면을 열었을 때, 앞사람이 로그인을 마치지 않고 남긴 사진이 그 사람의 '방금 고르신 여행'으로 뜨지 않게.
    주소의 쿼리는 브라우저만 안다: 서버가 그린 첫 화면에서는 없다고 보고, 그린 뒤에 안다(useSyncExternalStore 가 둘을 이어 준다).
  */
  const resumeAsked = useSyncExternalStore(
    noSubscribe,
    () => resumeRequested(window.location.search),
    () => false,
  );
  // 맡겨 둔 것을 읽어 보았는가(있든 없든). 돌아왔다는데 읽지 못하는 채로 기다리는 화면이 영영 남지 않게 시간 제한도 둔다.
  const [resumeSettled, setResumeSettled] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

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
          // 로그인 전이면 사진을 맡아 둘 수 있는지 미리 알아 둔다.
          if (!data.user) {
            const ok = await probeStash();
            if (active) setCanStash(ok);
          }
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

  // 돌아왔다는 표시가 있는데 기다림이 끝나지 않으면 그만 기다린다.
  useEffect(() => {
    if (!resumeAsked) return;
    const id = setTimeout(() => setResumeSettled(true), RESUME_WAIT_MS);
    return () => clearTimeout(id);
  }, [resumeAsked]);

  /*
    로그인하고 돌아왔으면 떠나기 전에 맡겨 둔 여행을 그 자리에서 연다 — 찾은 여행 · 고쳐 둔 제목과 동행 · 곳 이름까지.
    로그인한 사람에게만, 돌아왔다는 표시(?resume=1)가 있을 때만, 읽어 오는 동안 사람이 먼저 사진을 고르지 않았을 때만 연다.
  */
  useEffect(() => {
    if (!userId || !resumeAsked) return;
    let active = true;

    void readStash().then(async (meta) => {
      if (!active) return;
      setResumeSettled(true);
      if (!meta || epochRef.current !== 0) return;

      let savedTrips: Trip[] = [];
      try {
        savedTrips = fromStashed(meta.trips);
      } catch {
        // 읽을 수 없는 모양이다 — 아래에서 쓸 데 없는 것으로 치운다.
      }
      if (savedTrips.length === 0) {
        // 되살릴 여행이 하나도 없는 맡겨 둔 것은 쓸 데가 없다.
        void clearStash();
        return;
      }

      const known = new Map(meta.places);
      setTrips(savedTrips);
      setPlaceCache(known);
      setTitles(meta.titles);
      setCompanions(meta.companions);
      setRestored({ meta, recent: Date.now() - meta.savedAt < RECENT_MS });
      setStage({ name: "ready" });

      // 맡길 때 이름을 못 붙였던 곳은 다시 물어본다. 다 알고 있으면 묻지 않는다.
      try {
        const named = await lookupPlaces(savedTrips, known);
        if (active && epochRef.current === 0) setPlaceCache(named);
      } catch {
        // 이름을 못 붙여도 날짜와 사진은 그대로다.
      }
    });

    return () => {
      active = false;
    };
  }, [userId, resumeAsked]);

  /*
    맡겨 둔 여행의 카드에 붙일 작은 그림. 고른 파일은 로그인을 거치며 사라졌으니 맡겨 둔 목록 판으로 만든다. 나누기 · 합치기로
    카드의 사진이 바뀌면 모자란 것을 더 꺼낸다. 한 장씩 차례로 꺼내고, 화면에는 몇 장씩 모아 반영한다.
  */
  useEffect(() => {
    if (!restored) return;
    let alive = true;
    const cannotOpen = new Set(restored.meta.unsupported);
    const wanted = new Set<string>();
    for (const trip of trips) {
      for (const shot of pickPreviewShots(trip.shots)) {
        if (!cannotOpen.has(shot.id) && !triedPreviews.current.has(shot.id)) wanted.add(shot.id);
      }
    }

    const load = async () => {
      let batch: [string, File][] = [];
      const flush = () => {
        if (!alive || batch.length === 0) return;
        const arrived = batch;
        batch = [];
        setPicked((now) => {
          const next = new Map(now);
          for (const [id, file] of arrived) next.set(id, file);
          return next;
        });
      };

      for (const id of wanted) {
        if (!alive) return;
        const shrunk = await loadStashedPhoto(id);
        if (!alive) return;
        // 끝까지 해 본 것만 해 본 것으로 센다 — 중간에 끊긴 한 장은 다음에 다시 꺼낸다.
        triedPreviews.current.add(id);
        if (shrunk) batch.push([id, new File([shrunk.thumb], id, { type: shrunk.thumb.type })]);
        if (batch.length >= PREVIEW_FLUSH) flush();
      }
      flush();
    };
    void load();

    return () => {
      alive = false;
    };
  }, [trips, restored]);

  const rows = useMemo<Row[]>(
    () => trips.map((trip, index) => ({ trip, index, key: tripKey(trip) })),
    [trips],
  );

  const visible = useMemo(() => rows.filter(({ key }) => !dismissed.has(key)), [rows, dismissed]);

  // 새로 기록될 여행 수와, 이미 기록한 여행에 사진을 더할 여행 수(사진을 올릴 때만). 버튼에도 실제로 할 일의 수를 적어야
  // "3건 기록하기"를 눌렀는데 아무것도 안 늘어나는 일이 없다.
  const unsavedCount = useMemo(
    () => visible.filter(({ trip }) => !overlapsSaved(tripRange(trip), savedRanges)).length,
    [visible, savedRanges],
  );
  // 이 화면에서 방금 기록한(또는 더한) 여행은 다시 더하지 않는다 — 저장하지 못한 다른 여행만 다시 해 볼 때.
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  const addingCount = withPhotos
    ? visible.filter(({ trip, key }) => overlapsSaved(tripRange(trip), savedRanges) && !justSaved.has(key)).length
    : 0;

  // 로그인하러 떠나기 전에 맡아 둘 사진 — 눈에 보이는 여행에 든 것만. 뺀 여행의 사진까지 줄이느라 시간을 쓰지 않는다.
  const stashShots = useMemo(() => shotsOf(visible.map(({ trip }) => trip)), [visible]);

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

  /*
    화면을 처음 상태로 되돌린다(사진을 더 고르려고 · 맡겨 둔 여행을 버리려고). 맡겨 둔 여행으로 열린 화면이었으면 그 흔적도 걷는다.
    맡겨 둔 것을 지우는 일은 부르는 쪽이 정한다 — 버릴 때와 새로 고를 때만 지운다.
  */
  const startOver = () => {
    epochRef.current += 1;
    triedPreviews.current.clear();
    setRestored(null);
    setStashFailed(false);
    setJustSaved(new Set());
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
  };

  const handleFiles = async (files: File[]) => {
    setPicking(false);
    if (files.length === 0) return;
    epochRef.current += 1;
    // 맡겨 둔 여행으로 열린 화면에서 사진을 새로 고르면 맡겨 둔 것은 버린다.
    if (restored) {
      void clearStash();
      setRestored(null);
      triedPreviews.current.clear();
    }
    setStashFailed(false);
    setJustSaved(new Set());
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
    다른 화면의 [사진 고르기]로 사진첩을 열고 이 화면으로 온 경우(lib/photo/launch). 사진첩이 열려 있는 동안은 '불러오는 중'을
    보이고(창이 닫혀 초점이 돌아오면), 고른 사진이 오면 직접 고른 것과 똑같이 읽는다. 늦게 와도(이 화면이 뜨기 전에 골랐어도) 받는다.
  */
  const handleRef = useRef(handleFiles);
  useEffect(() => {
    handleRef.current = handleFiles;
  });
  useEffect(() => {
    let alive = true;
    let waiting = false;
    const onBack = () => {
      waiting = false;
      if (alive && launchOpened()) setPicking(true);
    };
    const sync = () => {
      if (!alive) return;
      const files = takePendingFiles();
      if (files) {
        void handleRef.current(files);
        return;
      }
      if (launchOpened()) {
        if (!waiting) {
          waiting = true;
          window.addEventListener("focus", onBack, { once: true });
        }
      } else {
        setPicking(false);
      }
    };
    const off = subscribeLaunch(sync);
    // 이 화면이 뜨기 전에 이미 열렸거나 골랐을 수 있다. 그리는 도중에 상태를 바꾸지 않도록 한 박자 뒤에 본다.
    void Promise.resolve().then(sync);
    return () => {
      alive = false;
      off();
      window.removeEventListener("focus", onBack);
    };
  }, []);

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
      merged: 0,
      duplicates: 0,
    };
    // 맡겨 둔 여행으로 열린 화면이면 올릴 사진은 고른 파일이 아니라 맡겨 둔 사진이다. 맡을 때 줄이지 못했던 것은 올릴 수 없다.
    const fromStash = restored;
    const cannotOpen = new Set(fromStash?.meta.unsupported ?? []);

    const done = new Set(justSaved);
    for (const { trip, key } of visible) {
      const range = tripRange(trip);
      // 같은 날짜의 여행이 이미 있으면 새 여행을 또 만들지 않고 그 여행에 새 사진만 더한다(lib/supabase/tripAdd).
      // 사진을 올리지 않는다면 더할 것이 없다.
      const overlapped = overlapsSaved(range, savedRanges);
      if (justSaved.has(key) || (overlapped && !withPhotos)) {
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

      // 사진이 어느 방문에 붙는가. 새 여행이면 방문마다 전부, 기존 여행에 더하면 이미 있던 것을 뺀 새 사진만.
      let placed: { visitId: string; shots: Shot[]; cover: boolean }[];
      if (overlapped) {
        const added = await addToExistingTrip(supabase, userId, shaped.visits, visitPlaces, range);
        if (!added.ok) {
          result.failed += 1;
          continue;
        }
        if (!added.found) {
          result.skipped += 1;
          continue;
        }
        result.merged += 1;
        done.add(key);
        result.duplicates += added.duplicates;
        placed = added.parts.map((part) => ({ visitId: part.visitId, shots: part.shots, cover: false }));
      } else {
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
        done.add(key);
        savedRanges.push(range);

        if (!withPhotos || !saved.visitIds) continue;
        placed = shaped.visits.flatMap((visit, visitIndex) => {
          const visitId = saved.visitIds![visitIndex];
          // 여행마다 첫 방문의 첫 장을 대표로 둔다.
          return visitId ? [{ visitId, shots: visit.shots, cover: visitIndex === 0 }] : [];
        });
      }

      const targets: UploadTarget[] = [];
      const prepared: PreparedTarget[] = [];
      let lost = 0;
      placed.forEach(({ visitId, shots, cover }) => {
        shots.forEach((shot, shotIndex) => {
          const place = {
            visitId,
            takenAt: shot.takenAt,
            lat: shot.lat,
            lng: shot.lng,
            isCover: cover && shotIndex === 0,
          };
          if (fromStash) {
            if (cannotOpen.has(shot.id)) {
              result.unsupported.push(shot.id);
              lost += 1;
            } else {
              prepared.push({ ...place, shotId: shot.id });
            }
            return;
          }
          const file = picked.get(shot.id);
          if (file) targets.push({ ...place, file });
        });
      });

      // 남은 시간은 실제로 걸린 시간에서 어림한다. 망 사정이 사람마다 다르다.
      // 걸린 시간은 올리는 쪽이 알려 준다. 화면이 시계를 들 일이 아니다.
      let elapsedMs = 0;
      const progress = (done: number, total: number, elapsed: number) => {
        elapsedMs = elapsed;
        const left = remainingText(done, total, elapsed);
        setUploadNote(`${done}장 / ${total}장${left ? ` · ${left}` : ""}`);
      };
      const uploaded = fromStash
        ? await uploadPrepared(supabase, userId, prepared, loadStashedPhoto, progress)
        : await uploadPhotos(supabase, userId, targets, progress);
      result.photos += uploaded.uploaded;
      result.unsupported.push(...uploaded.unsupported);
      result.overLimit += uploaded.overLimit;

      logEvent(supabase, "photos_uploaded", {
        tried: targets.length + prepared.length + lost,
        uploaded: uploaded.uploaded,
        // 아이폰 HEIC 가 여기로 온다(맡길 때 줄이지 못한 것까지). 이 수가 곧 남은 숙제의 크기다.
        unsupported: uploaded.unsupported.length + lost,
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

    /*
      맡겨 둔 것은 저장하지 못한 여행이 없을 때 지운다 — 기기에 사진 조각을 남기지 않는다. 저장하지 못한 여행이 있으면 남겨 둔다:
      다시 기록해 볼 때 같은 사진이 필요하다. 화면 쪽 표시도 이때 걷는다(결과 화면이 이미 덮고 있다).
    */
    if (fromStash && result.failed === 0) {
      await clearStash();
      setRestored(null);
    }

    setSavedRanges([...savedRanges]);
    setJustSaved(done);
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
    // 맡겨 둔 여행을 다 기록하지 못한 채 더 고르려는 것이면, 이 묶음은 여기서 끝이다 — 맡겨 둔 것도 접는다.
    if (restored) void clearStash();
    startOver();
    pick();
  };

  /** 맡겨 둔 여행을 버린다 — 맡겨 둔 것을 지우고 처음 화면으로 돌아간다. 원본 사진은 그대로다. */
  const discard = () => {
    void clearStash();
    startOver();
  };

  /*
    [로그인하고 기록하기]. 사진을 맡아 둘 수 있으면 떠나기 전에 올릴 크기로 줄여 이 브라우저에 맡기고, 찾은 여행을 적어 둔 뒤
    로그인으로 보낸다. 돌아오면 그 자리에서 이어진다. 맡지 못했으면 떠나지 않고 말한다 — 같은 사진을 다시 골라야 하니, 모르고
    로그인했다가 허탈하지 않게.
  */
  const login = async () => {
    if (preparingRef.current) return;
    preparingRef.current = true;
    const kept = visible.map(({ trip }) => trip);
    const usedPlaces = new Set(
      kept.flatMap((trip) => trip.visits).map((visit) => placeKey(visit.shots[0].lat, visit.shots[0].lng)),
    );
    setPreparing({ done: 0, total: stashShots.length, elapsedMs: 0 });

    let stashed = false;
    try {
      stashed = await prepareForLogin({
        shots: stashShots,
        files: picked,
        meta: {
          trips: toStashed(kept),
          titles,
          companions,
          places: [...placeCache].filter(([key]) => usedPlaces.has(key)),
        },
        onProgress: (done, total, elapsedMs) => {
          if (aliveRef.current) setPreparing({ done, total, elapsedMs });
        },
      });
    } catch {
      stashed = false;
    }
    preparingRef.current = false;
    // 준비하는 사이 이 화면을 떠났으면 로그인으로 끌고 가지 않는다.
    if (!aliveRef.current) return;
    setPreparing(null);
    if (stashed) goTo(RESUME_LOGIN_HREF);
    else setStashFailed(true);
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
  // 사진을 맡아 두고 떠날 수 있다 — 저장소가 되고, 아직 못 한 적이 없고, 맡을 만한 양일 때.
  const canLeaveWithPhotos = canStash && !stashFailed && canPrepare(stashShots.length);
  const preparingLeft = preparing ? remainingText(preparing.done, preparing.total, preparing.elapsedMs) : null;

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

  /*
    로그인하고 돌아와 맡겨 둔 여행을 읽는 동안. 이 사이에 '사진 고르기' 화면을 보이면 번쩍였다가 여행이 뜬다 — 돌아온 사람이 가장 많이
    마주치는 순간이라 기다린다고 말한다. 로그인하지 않았거나(이어 갈 수 없다) 읽어 보았으면(없었다) 곧바로 평소 화면이다.
  */
  const resuming = resumeAsked && !resumeSettled && !(authChecked && !userId);

  if (!hasTrips && resuming) {
    return (
      <>
        {picker}
        <ImportSteps current={1} />
        <Waiting title="고르신 여행을 이어서 열고 있어요" note="로그인하기 전에 고른 사진이에요. 이 기기 안에서만 열어요." />
      </>
    );
  }

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

      {restored && (
        <div className="flex items-start justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-text">
          <p className="min-w-0 break-keep">
            <span className="block font-semibold">
              {restored.recent ? "방금 고르신 여행이에요" : "전에 고르신 여행이에요"}
            </span>
            <span className="block text-[13px] text-text-muted">로그인하기 전에 고른 사진을 이 기기에 맡겨 두었어요.</span>
          </p>
          <button
            type="button"
            onClick={discard}
            className="shrink-0 text-[13px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text"
          >
            버리기
          </button>
        </div>
      )}

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

      {/* 로그인하러 떠나기 전에 사진을 줄여 맡기는 동안도 덮는다 — 중간에 만지면 맡기다 만 채로 떠난다. */}
      {preparing && (
        <WaitingOverlay
          title="로그인 전에 사진을 준비하고 있어요"
          detail={`${preparing.done}장 / ${preparing.total}장${preparingLeft ? ` · ${preparingLeft}` : ""}`}
          note="사진은 이 기기 안에만 있어요. 로그인하고 돌아오면 이어서 기록해요. 끝날 때까지 이 창을 닫지 마세요."
        />
      )}

      {visible.length > 0 && !noAdd && authChecked && (
        <SaveBar
          mode={signedOut ? "login" : "save"}
          count={unsavedCount}
          adding={addingCount}
          saving={saving}
          withPhotos={withPhotos}
          onWithPhotos={setWithPhotos}
          onSave={save}
          onLogin={signedOut && canLeaveWithPhotos ? () => void login() : undefined}
          notice={signedOut && stashFailed ? "이 브라우저에서는 사진을 잠깐 맡아 둘 수 없어요" : undefined}
        />
      )}
    </>
  );
}
