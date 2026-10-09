"use client";

import { AddPhotosLink } from "@/components/photo/AddPhotosLink";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { ownerOf, readFamilyView } from "@/lib/familyView";
import { markerUrls, visitCovers } from "@/lib/supabase/photos";
import { hubPlaces, placesIn, tripsIn, type Bounds, type HubPlace, type TripInView } from "@/lib/hub";
import { tripFocus } from "@/lib/scrollMemory";
import { ADD_HREF, SKETCH_HREF, hubHref, viewOf, type MyView } from "@/lib/nav";
import { useWide } from "@/lib/useWide";
import { Waiting } from "@/components/layout/Waiting";
import { HubMap, type CuratedPin, type FlyTarget, type HubMapHandle, type PaintedSido } from "./HubMap";
import { CollectionPanel } from "./CollectionPanel";
import { EchoCard } from "./EchoCard";
import { SpotPeek } from "./SpotPeek";
import { HubDialog } from "./HubDialog";
import { thumbUrls } from "@/lib/supabase/photos";
import { useWishlist } from "@/lib/collections";
import { MonthBars } from "./MonthBars";
import { REPLAY_HEIGHT, ReplayPanel } from "./ReplayPanel";
import {
  monthSpan,
  monthTotals,
  rangeLabel,
  replayOrder,
  withinMonths,
  echoOf,
  yearRange,
  type MonthRange,
} from "@/lib/timeline";
import { HubSheet, PEEK, PEEK_EMPTY, snapHeights, type Snap } from "./HubSheet";
import { PlacePanel } from "./PlacePanel";
import { TripsPanel } from "./TripsPanel";
import { ViewSwitch } from "./ViewSwitch";
import { TripCards } from "./TripCards";
import { MapOptions } from "./MapOptions";
import { PeriodChip } from "./PeriodChip";
import { TripArchive } from "@/components/trip/TripArchive";

/*
  내 여행의 첫 화면. 지도 하나에 내 사진이 다 얹힌다.

  여기서 모든 것이 갈라진다 — 사진을 넣고, 여행을 열고, 사진을 크게 보고,
  올해를 한 장으로 저장한다.

  내 여행은 한 화면의 두 모습이다 — 지도와 목록. 목록은 예전에 /trips 라는 따로
  선 화면이었다. 같은 여행이 세 곳(지도 시트·목록·한장)에 나뉘어 있고 "내 스케치"라는
  이름이 두 화면에 붙어, 어디에 있는지 알기 어려웠다. 지금은 스위치 하나로 오간다.
  모습은 주소(?view=list)에 적혀, 새로 고치거나 링크를 건네도 같은 모습이 된다.

  지도 모습에서 좁은 화면은 지도 위로 시트가 올라오고, 넓은 화면은 지도 옆에
  목록이 선다. 어느 쪽이든 그 목록에는 지금 지도에 보이는 것만 나온다. 모든 여행을
  검색하고 거르고 지우는 것은 목록 모습이 한다(TripArchive).
*/

type Status = "loading" | "guest" | "ready" | "failed";

interface SketchHubProps {
  /** 지도 위에 띄울 큰 갈래(내 여행 · 여행 100선). */
  switcher: ReactNode;
  /** 이 해를 골라 둔 채 연다. 한장 요약에서 "지도에서 보기"로 넘어올 때. */
  initialYear?: string;
  /** 어느 모습으로 열까. 주소의 ?view= 가 정한다. */
  initialView?: MyView;
}

/**
 * 내 여행. 지도와 목록 중 하나를 보인다.
 *
 * 모습의 진실은 주소(?view=)다. 직접 누르면 화면이 먼저 바뀌고 주소를 따라 적는다.
 * 그런데 주소가 밖에서 바뀔 수도 있다 — 목록을 보다가 위 띠의 "내 여행"(/?v=sketch)을
 * 누르면 같은 화면이 다시 그려지지 않고 주소만 바뀐다. 그때 화면이 그것을 따르지
 * 않으면 눌러도 아무 일이 없다.
 *
 * "주소가 지금 무엇인가"가 아니라 "주소가 바뀌었는가"를 본다. 직접 누른 뒤에는 화면이
 * 먼저 바뀌고 주소는 조금 늦게 따라오는데, 현재 값끼리 견주면 그 사이의 어긋남을 밖에서
 * 바뀐 것으로 읽어 도로 되돌린다.
 */
export function SketchHub({ switcher, initialYear, initialView = "map" }: SketchHubProps) {
  const params = useSearchParams();
  const urlView: MyView = params ? viewOf(params.get("view")) : initialView;
  const [view, setView] = useState<MyView>(urlView);
  const [seenUrlView, setSeenUrlView] = useState<MyView>(urlView);
  if (seenUrlView !== urlView) {
    setSeenUrlView(urlView);
    setView(urlView);
  }

  const change = useCallback(
    (next: MyView) => {
      setView(next);
      /*
        모습을 주소에 적는다 — 새로 고치거나 링크를 건네도 같은 모습이 되게. 화면을
        넘기는 것이 아니라 적어 두기만 한다. 보던 해(?y=)는 지도로 돌아올 때만 남긴다.
        목록에는 해가 없다.
      */
      window.history.replaceState(null, "", hubHref(next, next === "map" ? initialYear : undefined));
    },
    [initialYear],
  );

  /*
    목록 모습은 지도를 받아 오지 않는다. 지도는 위 화면이 불러오는 것이 많아(여행,
    대표 사진, 시도 경계) 목록으로 열 사람에게는 낭비이고, 목록(TripArchive)은 제 것을
    스스로 받아 온다. 지도로 돌아오면 그때 받아 온다 — 그 사이 지우거나 더한 여행이
    있어도 지도가 늘 지금 것을 보인다.
  */
  return view === "list" ? (
    <TripArchive onView={change} />
  ) : (
    <MapHub switcher={switcher} initialYear={initialYear} onList={() => change("list")} />
  );
}

interface MapHubProps {
  switcher: ReactNode;
  initialYear?: string;
  onList: () => void;
}

function MapHub({ switcher, initialYear, onList }: MapHubProps) {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [userId, setUserId] = useState<string | null>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [places, setPlaces] = useState<HubPlace[]>([]);
  const [pinUrls, setPinUrls] = useState<Map<string, string>>(new Map());
  const [returnTrip, setReturnTrip] = useState<string | null>(null);
  /** 오늘 날짜. "몇 해 전 이맘때"를 찾는 기준. 화면을 그리는 중에는 시계를 보지 않는다. */
  const [today, setToday] = useState("");

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (!data.user) {
        setStatus("guest");
        return;
      }
      // 가족의 여행을 보는 중이면 그 주인의 자료를 읽는다(권한은 DB 가 지킨다).
      const owner = ownerOf(readFamilyView(), data.user.id);
      setUserId(owner);
      const [rows, covers] = await Promise.all([fetchTrips(supabase, owner), visitCovers(supabase, owner)]);
      if (!active) return;
      if (!rows) {
        setStatus("failed");
        return;
      }

      const laid = hubPlaces(rows, covers);

      /*
        상세를 보고 "← 내 여행"으로 돌아왔으면 그 여행을 지도에 이어 두고
        그리로 날아간다. 보던 것을 다시 찾아 헤매지 않게.
      */
      const back = tripFocus.peek();
      if (back) {
        if (laid.some((place) => place.tripId === back)) setReturnTrip(back);
        tripFocus.forget();
      }

      setTrips(rows);
      setPlaces(laid);
      const now = new Date();
      setToday(
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
      );
      setStatus("ready");

      const paths = [...new Set(laid.map((place) => place.coverPath).filter((p): p is string => !!p))];
      const urls = await markerUrls(supabase, paths);
      if (active) setPinUrls(urls);
    });

    return () => {
      active = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="px-5 py-6">
        <Waiting title="지도에 내 사진을 얹고 있어요" />
      </div>
    );
  }

  return (
    <HubView
      status={status}
      userId={userId}
      trips={trips}
      places={places}
      pinUrls={pinUrls}
      returnTrip={returnTrip}
      today={today}
      initialYear={initialYear}
      switcher={switcher}
      onList={onList}
    />
  );
}

export interface HubViewProps {
  status: Exclude<Status, "loading">;
  userId: string | null;
  trips: { id: string; startedOn: string }[];
  places: HubPlace[];
  pinUrls: Map<string, string>;
  /** 상세에서 돌아왔으면 그 여행. 처음부터 이어 두고 그리로 난다. */
  returnTrip: string | null;
  /** "YYYY-MM-DD". 비어 있으면 "몇 해 전 이맘때"를 찾지 않는다. */
  today?: string;
  /** 이 해를 골라 둔 채 연다. */
  initialYear?: string;
  switcher: ReactNode;
  /** 목록 모습으로 넘어간다. 주지 않으면 스위치를 두지 않는다. */
  onList?: () => void;
}

/**
 * 지도와 시트. 받아 온 것을 보여 주기만 한다 — 받아 오는 것은 위의 몫이다.
 *
 * 둘을 나눈 까닭은 이것만 따로 띄워 볼 수 있게 하려는 것이다. 로그인
 * 없이는 받아 올 것이 없는데, 지도 위의 일은 로그인과 상관이 없다.
 */
export function HubView({
  status,
  userId,
  trips,
  places,
  pinUrls,
  returnTrip,
  today = "",
  initialYear,
  switcher,
  onList,
}: HubViewProps) {
  const wide = useWide();
  const [view, setView] = useState<Bounds | null>(null);
  const [picked, setPicked] = useState<HubPlace[] | null>(null);
  const [focused, setFocused] = useState<string | null>(returnTrip);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(() => {
    if (returnTrip) return { key: 0, places: places.filter((place) => place.tripId === returnTrip) };
    const whole = initialYear ? yearRange(monthSpan(places), initialYear) : null;
    const within = whole ? withinMonths(places, whole) : [];
    return within.length > 0 ? { key: 0, places: within } : null;
  });
  const [snap, setSnap] = useState<Snap>("peek");
  const [frame, setFrame] = useState(0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const flights = useRef(0);
  const mapHandle = useRef<HubMapHandle>(null);
  /** 달 막대로 고른 기간. 지도와 목록이 이 기간만 남긴다. */
  /*
    한장 요약에서 "그해를 지도에서 보기"로 넘어오면 그해가 골라진 채로
    연다. 막대에서 그해가 켜져 있다.
  */
  const [range, setRange] = useState<MonthRange | null>(() =>
    initialYear ? yearRange(monthSpan(places), initialYear) : null,
  );
  /** 다시 걷는 중이면 걸을 곳들. */
  const [replay, setReplay] = useState<HubPlace[] | null>(null);
  const [walkingAt, setWalkingAt] = useState<HubPlace | null>(null);
  /** 시트 속에 무엇을 펼쳤나. 칠한 곳 모음은 목록 대신 들어선다. */
  const [panel, setPanel] = useState<"trips" | "collection">("trips");
  /** 100선 겹쳐 보기. */
  const [showCurated, setShowCurated] = useState(false);
  const [pickedSpot, setPickedSpot] = useState<string | null>(null);
  /** 달 막대("기간")를 펼쳤는가. 살짝 올린 모습의 시트에는 자리가 없어, 그릴 때 따로 가린다. */
  const [periodOpen, setPeriodOpen] = useState(false);
  const wishlist = useWishlist();

  /*
    시도 경계(60KB)와 100선 자료(370KB)는 지도를 여는 데 필요 없다. 경계는
    곧바로, 100선은 겹쳐 보기를 켤 때 따로 불러온다.
  */
  const [sido, setSido] = useState<typeof import("@/lib/sido") | null>(null);
  const [curated, setCurated] = useState<typeof import("@/lib/curatedData") | null>(null);
  useEffect(() => {
    let active = true;
    void import("@/lib/sido").then((module) => {
      if (active) setSido(module);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!showCurated || curated) return;
    let active = true;
    void import("@/lib/curatedData").then((module) => {
      if (active) setCurated(module);
    });
    return () => {
      active = false;
    };
  }, [showCurated, curated]);

  const fly = useCallback((targets: HubPlace[]) => {
    flights.current += 1;
    setFlyTo({ key: flights.current, places: targets });
  }, []);

  // 틀의 높이. 시트가 멈출 칸을 이것으로 셈한다.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setFrame(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const empty = places.length === 0;
  const heights = useMemo(() => snapHeights(frame, empty ? PEEK_EMPTY : PEEK), [frame, empty]);
  /*
    지도 아래를 덮은 높이. 걷는 중이면 걷기 판이, 아니면 시트가 덮는다.
    넓은 화면에서 시트는 옆에 서므로 0.
  */
  const inset = replay ? REPLAY_HEIGHT : wide ? 0 : (dragHeight ?? heights[snap]);
  /*
    목록이 셀 범위는 시트를 가장 낮게 내렸을 때 보이는 땅이다. 시트를
    올리는 것은 목록을 읽으려는 것인데, 올린 만큼 범위를 줄이면 위쪽
    얇은 띠만 남아 "이 화면에는 다녀온 곳이 없어요"가 떴다 — 지도에는
    분명 핀이 보이는데. 올려도 목록은 그대로 둔다.
  */
  const viewInset = replay || wide ? inset : Math.min(inset, heights.peek);

  /*
    막대는 언제나 전체 기간을 보여 준다. 고른 기간만 남기면 막대가 줄어
    어디를 골랐는지, 앞뒤에 무엇이 있었는지가 사라진다.
  */
  const months = useMemo(() => monthSpan(places), [places]);
  const totals = useMemo(() => monthTotals(places), [places]);
  /** 기간으로 거른 것. 지도와 목록은 이것을 본다. */
  const shown = useMemo(() => withinMonths(places, range), [places, range]);

  const inView = useMemo(() => (view ? placesIn(shown, view) : shown), [shown, view]);
  const startedOn = useMemo(() => new Map(trips.map((trip) => [trip.id, trip.startedOn])), [trips]);
  const tripsInView = useMemo(
    () => tripsIn(inView, (id) => startedOn.get(id) ?? ""),
    [inView, startedOn],
  );
  /*
    시트에 늘어놓을 여행. 평소에는 지금 지도에 보이는 것만이다(지도를 옮기면 따라온다). 그런데 여행을 하나 고르면 지도가 그
    여행으로 날아가고, 그 바람에 목록이 그 여행 하나로 줄어 다른 여행으로 건너뛸 길이 사라진다. 고른 동안에는 기간 안의
    모든 여행을 늘어놓는다 — 줄이는 것은 지도를 직접 옮긴 손이 할 일이다.
  */
  const everyTrip = useMemo(
    () => tripsIn(shown, (id) => startedOn.get(id) ?? ""),
    [shown, startedOn],
  );
  const listed = focused ? everyTrip : tripsInView;
  /** 지도가 좁아서 목록이 줄어 있는가. 그렇다면 되돌릴 길(전체 보기)을 준다. */
  const narrowed = !focused && tripsInView.length < everyTrip.length;
  const route = useMemo(
    () =>
      focused
        ? places
            .filter((place) => place.tripId === focused)
            .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        : null,
    [places, focused],
  );
  const pickedIds = useMemo(
    () => new Set(walkingAt ? [walkingAt.visitId] : (picked ?? []).map((place) => place.visitId)),
    [picked, walkingAt],
  );

  const shownTrips = new Set(shown.map((place) => place.tripId)).size;
  const shownPhotos = shown.reduce((sum, place) => sum + place.photoCount, 0);

  /*
    시트를 옮길 때는 늘 이 길로. 살짝 내리면 달 막대는 접는다 — 접은 줄 알았던 막대가 다시 올릴 때 저절로 펼쳐져
    있으면 놀란다.
  */
  const changeSnap = (next: Snap) => {
    setSnap(next);
    if (next === "peek") setPeriodOpen(false);
  };

  /*
    달 막대는 "기간"을 눌러야 펼쳐진다. 살짝 올린 모습의 시트에는 막대가 들어갈 자리가 없다(여행 카드가 그 자리를
    쓴다) — 눌렀는데 접혀 있으면 안 되니 막대가 들어갈 만큼 시트를 올린다. 넓은 화면은 옆에 서 있는 목록이라 올릴 것이 없다.
  */
  const barsShown = periodOpen && months.length > 1 && (wide || snap !== "peek");
  const togglePeriod = () => {
    if (barsShown) {
      setPeriodOpen(false);
      return;
    }
    setPeriodOpen(true);
    if (!wide && snap === "peek") setSnap("half");
  };

  /*
    여행은 한 번에 한 모습으로만 그린다. 살짝 올린 모습에서는 가로 카드, 끌어올리면 세로 목록이다. 같은 여행이 둘로
    보이면 어느 것을 눌러야 하는지 헷갈리고, 화면 읽기 도구는 둘 다 읽는다. 끌어올리는 동안에는 둘 다 둔다 — 올라오는
    시트가 빈 칸으로 비어 보이지 않게.
  */
  const compact = !wide && snap === "peek";
  const showCards = compact;
  const showList = !compact || dragHeight !== null;

  /*
    다시 걸을 것은 지금 고른 여행이다. 따로 묻지 않는다 — 무엇을 걷고
    싶은지는 이미 화면에 골라 두었다.

    "전부 다시 걷기"와 "이 기간 다시 걷기"는 뺐다. 여러 여행을 이어
    걷는 것은 너무 길어 쓰이지 않았다. 여행을 고르지 않았으면 걷기
    단추를 두지 않는다.
  */
  const walkable = route ?? [];
  const walkLabel = route ? "이 여행 다시 걷기" : null;

  const startWalk = () => {
    if (walkable.length === 0) return;
    setPicked(null);
    setReplay(replayOrder(walkable));
  };

  const stopWalk = () => {
    mapHandle.current?.clearTrail();
    setWalkingAt(null);
    setReplay(null);
  };

  const chooseRange = (next: MonthRange | null) => {
    setRange(next);
    setPicked(null);
    setFocused(null);
    const within = withinMonths(places, next);
    if (within.length > 0) fly(within);
  };

  /*
    칠하기와 셈은 지금 보는 것(기간으로 거른 것)을 따른다. 기간을 골랐는데
    칠한 곳이 그대로면 무엇을 센 것인지 헷갈린다.
  */
  const tally = useMemo(() => (sido ? sido.sidoTally(shown) : new Map<string, number>()), [sido, shown]);
  const painted: PaintedSido[] = useMemo(
    () =>
      sido
        ? sido.SIDO.filter((entry) => tally.has(entry.name)).map((entry) => ({
            name: entry.name,
            polygons: entry.polygons,
          }))
        : [],
    [sido, tally],
  );
  const curatedSeen = useMemo(
    () => new Set(shown.map((place) => place.spotId).filter((id): id is string => !!id)),
    [shown],
  );
  /*
    100선 겹쳐 보기에서 빼는 것은 평생 다녀온 곳이다. 작년에 간 곳을 올해
    기간으로 걸렀다고 빈 동그라미로 되살리면 안 간 곳처럼 보인다.
  */
  const everSeen = useMemo(
    () => new Set(places.map((place) => place.spotId).filter((id): id is string => !!id)),
    [places],
  );
  const curatedPins: CuratedPin[] | null = useMemo(
    () =>
      showCurated && curated
        ? curated.SPOTS.filter((spot) => !everSeen.has(spot.id)).map((spot) => ({
            id: spot.id,
            name: spot.name,
            lat: spot.lat,
            lng: spot.lng,
            wished: wishlist.ids.includes(spot.id),
          }))
        : null,
    [showCurated, curated, everSeen, wishlist.ids],
  );
  const spot = pickedSpot && curated ? (curated.SPOTS.find((entry) => entry.id === pickedSpot) ?? null) : null;

  const echo = useMemo(() => (today ? echoOf(places, today) : null), [places, today]);
  const [echoPhoto, setEchoPhoto] = useState<string | undefined>();
  useEffect(() => {
    const path = echo?.place.coverPath;
    const supabase = getBrowserClient();
    if (!path || !supabase) return;
    let active = true;
    void thumbUrls(supabase, [path]).then((urls) => {
      if (active) setEchoPhoto(urls.get(path));
    });
    return () => {
      active = false;
    };
  }, [echo]);

  /** 시트 속을 목록으로 되돌린다. */
  const backToList = () => {
    setPicked(null);
    setPickedSpot(null);
    setPanel("trips");
  };

  const openCollection = () => {
    setPicked(null);
    setPickedSpot(null);
    setPanel("collection");
  };

  const toggleCurated = () => {
    if (showCurated) setPickedSpot(null);
    setShowCurated(!showCurated);
  };

  /*
    밟은 시도는 그곳 여행으로 날아간다. 안 밟은 시도는 그리로 날아가
    100선을 겹쳐 보인다 — 다음에 갈 곳이 거기 있다. 지도가 보이게
    시트는 내린다.
  */
  const flyToSido = (name: string, visited: boolean) => {
    if (!sido) return;
    backToList();
    if (visited) {
      fly(shown.filter((place) => sido.sidoOf(place) === name));
    } else {
      setShowCurated(true);
      flights.current += 1;
      setFlyTo({ key: flights.current, places: sido.sidoBounds(name) });
    }
    changeSnap("peek");
  };

  const pickSpot = (id: string) => {
    setPicked(null);
    setPickedSpot(id);
  };

  const pick = (targets: HubPlace[]) => {
    setPickedSpot(null);
    setPicked(targets);
    // 사진을 보려고 누른 것이다. 사진이 보일 만큼 올린다.
  };

  const focusTrip = (trip: TripInView) => {
    setPicked(null);
    setFocused(trip.tripId);
    fly(places.filter((place) => place.tripId === trip.tripId));
  };

  const showAllTrips = () => {
    setFocused(null);
    // 기간을 골랐으면 그 기간의 여행이 다 보이게. 기간 밖 여행까지 보이게 날아가면 고른 기간이 무색하다.
    fly(shown.length > 0 ? shown : places);
  };

  const header = (
    <SheetHeader
      status={status}
      tripCount={range ? shownTrips : trips.length}
      photoCount={shownPhotos}
      placesOnScreen={inView.length}
      focused={focused !== null}
      onClearFocus={() => setFocused(null)}
      narrowed={narrowed}
      onShowAll={showAllTrips}
      wide={wide}
      cards={
        showCards && status === "ready" && places.length > 0 ? (
          <TripCards
            trips={listed}
            focused={focused}
            photoUrls={pinUrls}
            onFocus={focusTrip}
            onShowAll={showAllTrips}
          />
        ) : null
      }
      periodChip={months.length > 1 ? <PeriodChip range={range} open={barsShown} onToggle={togglePeriod} /> : null}
      timeline={
        barsShown ? <MonthBars months={months} totals={totals} range={range} onRange={chooseRange} /> : null
      }
      walkLabel={walkable.length > 0 ? walkLabel : null}
      onWalk={startWalk}
      onList={onList}
    />
  );

  const walking = replay && (
    <ReplayPanel
      userId={userId}
      stops={replay}
      map={mapHandle}
      onAt={setWalkingAt}
      onClose={stopWalk}
    />
  );

  /*
    누른 것은 창으로 띄운다. 시트 속에 펼치면 반쯤 올라온 시트 아래로
    사진이 잘려, 보려면 시트 안을 굴려야 했다. 시트는 목록만 맡는다.
  */
  const detail: { label: string; content: ReactNode } | null =
    status !== "ready" || replay
      ? null
      : spot
        ? { label: spot.name, content: <SpotPeek spot={spot} thumbnail={curated?.thumbnailOf(spot.id)} /> }
        : picked && userId
          ? { label: picked[0].placeName, content: <PlacePanel userId={userId} places={picked} /> }
          : panel === "collection"
            ? {
                label: "칠한 곳",
                content: (
                  <CollectionPanel
                    tally={tally}
                    rangeText={range ? rangeLabel(range) : null}
                    curatedVisited={curatedSeen.size}
                    curatedTotal={121}
                    onSido={flyToSido}
                  />
                ),
              }
            : null;

  const body =
    status !== "ready" || places.length === 0 || !showList ? null : (
      <>
        {echo && !range && !focused && (
          <EchoCard
            echo={echo}
            photo={echoPhoto}
            onOpen={(place) => {
              pick([place]);
              fly([place]);
            }}
          />
        )}
        <TripsPanel
          trips={listed}
          focused={focused}
          photoUrls={pinUrls}
          onFocus={focusTrip}
          onShowAll={showAllTrips}
        />
      </>
    );

  const map = (
    <HubMap
      ref={mapHandle}
      places={shown}
      photoUrls={pinUrls}
      // 걷는 동안에는 걸음 자국이 선을 대신한다.
      route={replay ? null : route}
      pickedIds={pickedIds}
      flyTo={flyTo}
      bottomInset={inset}
      viewInset={viewInset}
      onView={setView}
      onPick={pick}
      painted={painted}
      curated={replay ? null : curatedPins}
      onPickSpot={pickSpot}
    />
  );

  /*
    지도 위 왼쪽에 띄우는 단추 하나. 칠한 곳 모음(다녀온 시도)과 100선 겹쳐 보기가 이 안에 있다 — 예전에는 칩 둘이
    늘 떠 있어 무엇인지 알기 어렵고 지도를 가렸다. 아직 얹을 것이 없으면 띄우지 않는다.
  */
  const controls = !empty && !replay && (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col items-start gap-2 sm:top-[68px]">
      <MapOptions
        sidoCount={sido ? tally.size : null}
        curatedOn={showCurated}
        onSido={openCollection}
        onCurated={toggleCurated}
      />
    </div>
  );

  return (
    <div
      ref={frameRef}
      /*
        위 띠(57px)와 폰의 하단 탭을 뺀 화면 전체. 지도는 가장자리까지 꽉 채운다.
        탭 높이(--bottom-nav-h)는 탭이 있는 좁은 화면에서만 0 이 아니다.
      */
      className="relative h-[calc(100dvh-57px-var(--bottom-nav-h,0px))] min-h-[480px] w-full overflow-hidden"
    >
      {wide ? (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_400px]">
          <div className="relative">
            {map}
            <Floating>{switcher}</Floating>
            {controls}
            {walking && <div className="absolute inset-x-4 bottom-0 z-20 mx-auto max-w-xl">{walking}</div>}
          </div>
          <aside aria-label="내 여행 목록" className="flex min-h-0 flex-col border-l border-line bg-surface">
            <div className="shrink-0 border-b border-line px-5 py-4">{header}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{body}</div>
          </aside>
        </div>
      ) : (
        <>
          {map}
          <Floating>{switcher}</Floating>
          {controls}
          {walking ? (
            <div className="absolute inset-x-0 bottom-0 z-20">{walking}</div>
          ) : (
          <HubSheet
            snap={snap}
            onSnap={(next) => {
              changeSnap(next);
              setDragHeight(null);
            }}
            heights={heights}
            onHeight={setDragHeight}
            header={header}
          >
            {body}
          </HubSheet>
          )}
        </>
      )}
      {detail && (
        <HubDialog label={detail.label} onClose={backToList}>
          {detail.content}
        </HubDialog>
      )}
    </div>
  );
}

/**
 * 지도 위 가운데 위쪽에 띄운다. 지도를 가리는 것은 이 한 줄뿐이다.
 *
 * 폰에서는 접는다. 큰 갈래(내 여행 · 여행 100선)는 아래 하단 탭이 이미 하고 있다.
 */
function Floating({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4 max-sm:hidden">
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}

interface SheetHeaderProps {
  status: Status;
  tripCount: number;
  photoCount: number;
  placesOnScreen: number;
  /** 여행을 하나 골라 지도에 이어 두었는가. */
  focused: boolean;
  onClearFocus: () => void;
  /** 지도가 좁아서 목록이 줄어 있는가. */
  narrowed: boolean;
  /** 모든 여행이 보이게 지도를 넓힌다. */
  onShowAll: () => void;
  /** 옆 목록(넓은 화면)인가. 좁은 화면의 시트는 높이가 못 박혀 있어 단추 줄이 줄을 바꾸면 안 된다. */
  wide: boolean;
  /** 여행 카드 줄. 살짝 올린 모습에서만 있다 — 끌어올리면 세로 목록이 그 일을 한다. */
  cards: ReactNode;
  /** "기간" 단추. 달이 하나뿐이면 고를 기간이 없어 없다. */
  periodChip: ReactNode;
  /** 펼친 달 막대. "기간"을 눌러야 있다. */
  timeline: ReactNode;
  /** 다시 걷기 단추의 이름. 걸을 것이 없으면 null. */
  walkLabel: string | null;
  onWalk: () => void;
  /** 목록 모습으로 넘어간다. 주지 않으면 스위치를 두지 않는다. */
  onList?: () => void;
}

/*
  시트의 머리. 살짝만 올려도 보이는 자리라, 여기에 갈림길을 모아 둔다.
  무엇을 할 수 있는지가 지도를 가리지 않고 늘 손 닿는 데 있다.
*/
function SheetHeader({
  status,
  tripCount,
  photoCount,
  placesOnScreen,
  focused,
  onClearFocus,
  narrowed,
  onShowAll,
  wide,
  cards,
  periodChip,
  timeline,
  walkLabel,
  onWalk,
  onList,
}: SheetHeaderProps) {
  if (status === "guest") {
    return (
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-[15px] font-semibold text-text">다녀온 곳이 이 지도에 사진으로 찍혀요</p>
        <p className="text-[13px] text-text-muted">사진을 고르면 언제 어디서 찍었는지 읽어 지도에 얹어 드려요.</p>
        {/*
          첫 화면의 환영 팝업과 같은 약속, 같은 단추. 로그인부터 하라고 하면 빈 벽이다 — 사진 고르기는 로그인 없이
          시작하고, 로그인은 기록으로 남길 때 한다. 이미 계정이 있는 사람을 위해 로그인은 곁에 작게 둔다.
        */}
        <div className="flex items-center gap-4">
          <AddPhotosLink
            href={ADD_HREF}
            className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            사진 고르기
          </AddPhotosLink>
          <Link
            href="/login?next=%2F%3Fv%3Dsketch"
            className="text-[14px] font-medium text-accent transition hover:text-accent-hover"
          >
            로그인
          </Link>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return <p className="pb-1 text-[14px] text-text-muted">기록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>;
  }

  if (tripCount === 0) {
    return (
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-[15px] font-semibold text-text">사진을 고르면 여기에 점이 찍혀요</p>
        <p className="text-[13px] text-text-muted">찍은 시각과 위치를 읽어 다녀온 길을 지도에 그려 드려요.</p>
        <AddPhotosLink
          href={ADD_HREF}
          className="self-start rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          사진 고르기
        </AddPhotosLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        {/* 첫 줄은 늘 무엇의 목록인지다. 고른 여행의 이름은 고른 카드 · 줄이 말한다. */}
        <p className="min-w-0 truncate text-[15px] font-semibold text-text">
          내 여행 {tripCount}개
          <span className="ml-1.5 text-[13px] font-normal text-text-faint">사진 {photoCount}장</span>
        </p>
        {focused ? (
          <button
            type="button"
            onClick={onClearFocus}
            className="shrink-0 text-[13px] font-medium text-text-muted hover:text-text"
          >
            선택 풀기
          </button>
        ) : (
          <span className="flex shrink-0 items-baseline gap-2 text-[13px]">
            <span className="text-text-faint">이 화면 {placesOnScreen}곳</span>
            {narrowed && (
              <button
                type="button"
                onClick={onShowAll}
                className="font-medium text-accent transition hover:text-accent-hover"
              >
                전체 보기
              </button>
            )}
          </span>
        )}
      </div>
      {cards}
      {timeline}
      <div
        className={`flex items-center gap-2 pb-0.5 ${wide ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none]"}`}
      >
        {/*
          다시 걷기가 맨 앞이다. 이 화면에서 다른 데서는 못 하는 일이
          이것이다.
        */}
        {walkLabel && (
          <button
            type="button"
            onClick={onWalk}
            className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            ▶ {walkLabel}
          </button>
        )}
        {/* 달 막대를 여닫는다. 거른 기간이 있으면 이 단추가 말한다. */}
        {periodChip}
        {/* 같은 여행을 목록으로도 본다. 검색하고 거르고 지우는 것은 그쪽이 한다. */}
        {onList && <ViewSwitch view="map" onChange={onList} />}
        {/* 폰에서는 접는다 — 하단 탭의 가운데 단추와 "한장"이 이 일을 한다. */}
        <AddPhotosLink
          href={ADD_HREF}
          className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line max-sm:hidden"
        >
          + 사진 고르기
        </AddPhotosLink>
        <Link
          href={SKETCH_HREF}
          className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line max-sm:hidden"
        >
          한장 요약
        </Link>
      </div>
    </div>
  );
}
