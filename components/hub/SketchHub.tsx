"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchTrips, type SavedTrip } from "@/lib/supabase/trips";
import { markerUrls, visitCovers } from "@/lib/supabase/photos";
import { hubPlaces, placesIn, tripsIn, type Bounds, type HubPlace, type TripInView } from "@/lib/hub";
import { tripFocus } from "@/lib/scrollMemory";
import { useWide } from "@/lib/useWide";
import { Waiting } from "@/components/layout/Waiting";
import { HubMap, type FlyTarget } from "./HubMap";
import { HubSheet, PEEK, PEEK_EMPTY, snapHeights, type Snap } from "./HubSheet";
import { PlacePanel } from "./PlacePanel";
import { TripsPanel } from "./TripsPanel";

/*
  내 스케치의 첫 화면. 지도 하나에 내 사진이 다 얹힌다.

  여기서 모든 것이 갈라진다 — 사진을 넣고, 여행을 열고, 사진을 크게 보고,
  올해를 한 장으로 저장한다. 목록 화면(/trips)과 연도 카드(/sketch)는
  그대로 두고, 이 화면에서 그리로 가는 길을 낸다.

  좁은 화면은 지도 위로 시트가 올라오고, 넓은 화면은 지도 옆에 목록이
  선다. 어느 쪽이든 목록에는 지금 지도에 보이는 것만 나온다.
*/

type Status = "loading" | "guest" | "ready" | "failed";

interface SketchHubProps {
  /** 지도 위에 띄울 큰 갈래(내 스케치 · 여행 100선). */
  switcher: ReactNode;
}

export function SketchHub({ switcher }: SketchHubProps) {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "guest");
  const [userId, setUserId] = useState<string | null>(null);
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [places, setPlaces] = useState<HubPlace[]>([]);
  const [pinUrls, setPinUrls] = useState<Map<string, string>>(new Map());
  const [returnTrip, setReturnTrip] = useState<string | null>(null);

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
      setUserId(data.user.id);
      const [rows, covers] = await Promise.all([
        fetchTrips(supabase, data.user.id),
        visitCovers(supabase, data.user.id),
      ]);
      if (!active) return;
      if (!rows) {
        setStatus("failed");
        return;
      }

      const laid = hubPlaces(rows, covers);

      /*
        상세를 보고 "← 내 스케치"로 돌아왔으면 그 여행을 지도에 이어 두고
        그리로 날아간다. 보던 것을 다시 찾아 헤매지 않게.
      */
      const back = tripFocus.peek();
      if (back) {
        if (laid.some((place) => place.tripId === back)) setReturnTrip(back);
        tripFocus.forget();
      }

      setTrips(rows);
      setPlaces(laid);
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
      switcher={switcher}
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
  switcher: ReactNode;
}

/**
 * 지도와 시트. 받아 온 것을 보여 주기만 한다 — 받아 오는 것은 위의 몫이다.
 *
 * 둘을 나눈 까닭은 이것만 따로 띄워 볼 수 있게 하려는 것이다. 로그인
 * 없이는 받아 올 것이 없는데, 지도 위의 일은 로그인과 상관이 없다.
 */
export function HubView({ status, userId, trips, places, pinUrls, returnTrip, switcher }: HubViewProps) {
  const wide = useWide();
  const [view, setView] = useState<Bounds | null>(null);
  const [picked, setPicked] = useState<HubPlace[] | null>(null);
  const [focused, setFocused] = useState<string | null>(returnTrip);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(() =>
    returnTrip ? { key: 0, places: places.filter((place) => place.tripId === returnTrip) } : null,
  );
  const [snap, setSnap] = useState<Snap>("peek");
  const [frame, setFrame] = useState(0);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const flights = useRef(0);

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
  /** 지도 아래를 시트가 덮은 높이. 넓은 화면에서는 옆에 서므로 0. */
  const inset = wide ? 0 : (dragHeight ?? heights[snap]);

  const inView = useMemo(() => (view ? placesIn(places, view) : places), [places, view]);
  const startedOn = useMemo(() => new Map(trips.map((trip) => [trip.id, trip.startedOn])), [trips]);
  const tripsInView = useMemo(
    () => tripsIn(inView, (id) => startedOn.get(id) ?? ""),
    [inView, startedOn],
  );
  const route = useMemo(
    () =>
      focused
        ? places
            .filter((place) => place.tripId === focused)
            .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
        : null,
    [places, focused],
  );
  const pickedIds = useMemo(() => new Set((picked ?? []).map((place) => place.visitId)), [picked]);

  const totalPhotos = places.reduce((sum, place) => sum + place.photoCount, 0);

  const pick = (targets: HubPlace[]) => {
    setPicked(targets);
    // 사진을 보려고 누른 것이다. 사진이 보일 만큼 올린다.
    if (snap === "peek") setSnap("half");
  };

  const focusTrip = (trip: TripInView) => {
    setPicked(null);
    setFocused(trip.tripId);
    fly(places.filter((place) => place.tripId === trip.tripId));
  };

  const header = (
    <SheetHeader
      status={status}
      tripCount={trips.length}
      photoCount={totalPhotos}
      placesOnScreen={inView.length}
      focusedLabel={focused ? (tripsInView.find((trip) => trip.tripId === focused)?.label ?? null) : null}
      onClearFocus={() => setFocused(null)}
    />
  );

  const body =
    status !== "ready" || places.length === 0 ? null : picked && userId ? (
      <PlacePanel userId={userId} places={picked} onBack={() => setPicked(null)} />
    ) : (
      <TripsPanel
        trips={tripsInView}
        focused={focused}
        photoUrls={pinUrls}
        onFocus={focusTrip}
        onShowAll={() => {
          setFocused(null);
          fly(places);
        }}
      />
    );

  const map = (
    <HubMap
      places={places}
      photoUrls={pinUrls}
      route={route}
      pickedIds={pickedIds}
      flyTo={flyTo}
      bottomInset={inset}
      onView={setView}
      onPick={pick}
    />
  );

  return (
    <div
      ref={frameRef}
      /* 위 띠(57px)를 뺀 화면 전체. 지도는 가장자리까지 꽉 채운다. */
      className="relative h-[calc(100dvh-57px)] min-h-[480px] w-full overflow-hidden"
    >
      {wide ? (
        <div className="grid h-full grid-cols-[minmax(0,1fr)_400px]">
          <div className="relative">
            {map}
            <Floating>{switcher}</Floating>
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
          <HubSheet
            snap={snap}
            onSnap={(next) => {
              setSnap(next);
              setDragHeight(null);
            }}
            heights={heights}
            onHeight={setDragHeight}
            header={header}
          >
            {body}
          </HubSheet>
        </>
      )}
    </div>
  );
}

/** 지도 위 가운데 위쪽에 띄운다. 지도를 가리는 것은 이 한 줄뿐이다. */
function Floating({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
      <div className="pointer-events-auto">{children}</div>
    </div>
  );
}

interface SheetHeaderProps {
  status: Status;
  tripCount: number;
  photoCount: number;
  placesOnScreen: number;
  focusedLabel: string | null;
  onClearFocus: () => void;
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
  focusedLabel,
  onClearFocus,
}: SheetHeaderProps) {
  if (status === "guest") {
    return (
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-[15px] font-semibold text-text">다녀온 곳이 이 지도에 사진으로 찍혀요</p>
        <p className="text-[13px] text-text-muted">로그인하고 사진을 고르면, 언제 어디서 찍었는지 읽어 지도에 얹어 드려요.</p>
        <Link
          href="/login?next=%2F%3Fv%3Dsketch"
          className="self-start rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          로그인하기
        </Link>
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
        <Link
          href="/trips/new"
          className="self-start rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          사진 고르기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-text">
          {focusedLabel ?? `여행 ${tripCount} · 사진 ${photoCount}장`}
        </p>
        {focusedLabel ? (
          <button
            type="button"
            onClick={onClearFocus}
            className="shrink-0 text-[13px] font-medium text-text-muted hover:text-text"
          >
            잇기 끄기
          </button>
        ) : (
          <span className="shrink-0 text-[13px] text-text-faint">이 화면 {placesOnScreen}곳</span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        <Link
          href="/trips/new"
          className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          + 사진등록
        </Link>
        <Link
          href="/trips"
          className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
        >
          목록으로
        </Link>
        <Link
          href="/sketch"
          className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
        >
          올해의 한 장
        </Link>
      </div>
    </div>
  );
}
