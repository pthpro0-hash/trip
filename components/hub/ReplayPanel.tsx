"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchPlacePhotos, thumbUrls } from "@/lib/supabase/photos";
import { dwellMs, trailSegments } from "@/lib/timeline";
import type { HubPlace } from "@/lib/hub";
import type { HubMapHandle } from "./HubMap";

/*
  ▶ 다시 걷기.

  고른 것을 찍은 순서대로 따라간다. 한 곳에 닿으면 그때 사진을 띄우고,
  잠시 머물렀다가 다음 곳으로 선을 늘인다. 사진 앨범은 사진을 시간순으로
  늘어놓을 뿐이지만, 이것은 그 사진들이 어디서 어디로 이어졌는지를
  보여 준다.

  멈추고, 건너뛰고, 그만둘 수 있다. 끝나면 걸은 길이 지도에 남는다.
*/

/** 이 판의 높이. 지도는 그 위만큼을 보이는 땅으로 친다. */
export const REPLAY_HEIGHT = 264;
/** 선을 늘이는 시간. */
const GROW_MS = 750;
/** 한 곳에 띄울 사진 수. */
const SHOTS = 3;

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-09-14 06:11:00" → "2026.09.14 (일) 오전 6시" */
export function stampLabel(stamp: string): string {
  const date = new Date(stamp.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return stamp.slice(0, 10).replaceAll("-", ".");
  const hour = date.getHours();
  const half = hour < 12 ? "오전" : "오후";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${stamp.slice(0, 10).replaceAll("-", ".")} (${WEEKDAY[date.getDay()]}) ${half} ${shown}시`;
}

interface ReplayPanelProps {
  userId: string | null;
  stops: HubPlace[];
  map: RefObject<HubMapHandle | null>;
  /** 지금 닿은 곳. 지도가 그 핀에 테를 두른다. */
  onAt: (place: HubPlace | null) => void;
  onClose: () => void;
}

export function ReplayPanel({ userId, stops, map, onAt, onClose }: ReplayPanelProps) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  /** 걸음을 처음부터 다시 셀 때마다 바꾼다. 같은 걸음을 두 번 걸어도 다시 돈다. */
  const [round, setRound] = useState(0);
  const [shots, setShots] = useState<Map<string, string[]>>(new Map());

  const dwell = dwellMs(stops.length);
  const current = stops[Math.min(step, stops.length - 1)];

  // 곳마다 띄울 사진. 걷기 시작할 때 한꺼번에 주소를 받아 둔다 — 걸음마다
  // 받으면 닿을 때마다 사진이 늦게 뜬다.
  const visitKey = stops.map((stop) => stop.visitId).join(",");
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;
    let active = true;

    void (async () => {
      const photos = await fetchPlacePhotos(supabase, userId, visitKey.split(","));
      const firsts = new Map<string, string[]>();
      for (const photo of photos) {
        const list = firsts.get(photo.visitId) ?? [];
        if (list.length < SHOTS) list.push(photo.storagePath);
        firsts.set(photo.visitId, list);
      }
      const urls = await thumbUrls(supabase, [...firsts.values()].flat());
      if (!active) return;
      setShots(
        new Map(
          [...firsts].map(([visitId, paths]) => [
            visitId,
            paths.map((path) => urls.get(path)).filter((url): url is string => !!url),
          ]),
        ),
      );
    })();

    return () => {
      active = false;
    };
  }, [userId, visitKey]);

  // 한 걸음. 맞추고, 선을 늘이고, 머물렀다가, 다음으로.
  useEffect(() => {
    const handle = map.current;
    if (!handle || done || paused || stops.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const here = stops[step];
    const previous = stops[step - 1];
    const walkedSoFar = trailSegments(stops, step);
    onAt(here);

    // 움직임을 줄여 달라고 한 사람에게는 선을 늘이지 않고 곧장 긋는다.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /*
      같은 여행 안이면 앞의 곳에서 선을 늘인다. 여행이 바뀌면 새 토막을
      시작한다 — 지난 여행의 끝과 이번 여행의 처음 사이는 아무도 걷지
      않았다.
    */
    let walked: Promise<void>;
    if (previous && previous.tripId === here.tripId) {
      handle.frame([previous, here]);
      walked = handle.grow(walkedSoFar, here, calm ? 0 : GROW_MS);
    } else {
      handle.frame([here]);
      handle.trail([...walkedSoFar, [here]]);
      walked = Promise.resolve();
    }

    void walked.then(() => {
      if (cancelled) return;
      // 다음 곳 사진을 미리 받아 둔다. 닿자마자 떠야 걸음이 끊기지 않는다.
      const next = stops[step + 1];
      for (const url of (next && shots.get(next.visitId)) ?? []) new Image().src = url;

      timer = setTimeout(() => {
        if (step + 1 < stops.length) setStep(step + 1);
        else setDone(true);
      }, dwell);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // shots 는 뒤늦게 와도 걸음을 되돌리지 않는다. 다음 걸음에서 쓰면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paused, done, round, stops, dwell]);

  // 끝나면 걸은 길 전체가 보이게 물러선다.
  useEffect(() => {
    if (!done) return;
    onAt(null);
    map.current?.frame(stops);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const totalPhotos = useMemo(() => stops.reduce((sum, stop) => sum + stop.photoCount, 0), [stops]);
  const photos = shots.get(current?.visitId ?? "") ?? [];

  const restart = () => {
    map.current?.clearTrail();
    setDone(false);
    setPaused(false);
    setStep(0);
    setRound(round + 1);
  };

  return (
    <section
      aria-label="다시 걷기"
      aria-live="polite"
      className="flex flex-col gap-3 rounded-t-[20px] bg-surface px-4 pb-4 pt-3 shadow-[0_-6px_24px_rgba(0,0,0,0.14)] ring-1 ring-line"
      style={{ height: REPLAY_HEIGHT }}
    >
      {/* 얼마나 왔는지. 숫자보다 먼저 눈에 들어온다. */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${done ? 100 : ((step + 1) / stops.length) * 100}%` }}
        />
      </div>

      {done ? (
        <div className="flex flex-1 flex-col justify-center gap-1">
          <p className="text-[20px] font-bold tracking-tight text-text">다 걸었어요</p>
          <p className="text-[14px] text-text-muted">
            {stops.length}곳 · 사진 {totalPhotos}장. 걸은 길이 지도에 남아 있어요.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-medium tabular-nums text-text-faint">
              {step + 1} / {stops.length} · {stampLabel(current.startedAt)}
            </p>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[19px] font-bold tracking-tight text-text">{current.placeName}</p>
            <p className="truncate text-[13px] text-text-muted">{current.tripLabel}</p>
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
            {[0, 1, 2].map((slot) => (
              <span key={slot} className="overflow-hidden rounded-lg bg-bg-subtle">
                {photos[slot] && (
                  // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                  <img src={photos[slot]} alt="" className="h-full w-full object-cover" />
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        {done ? (
          <button
            type="button"
            onClick={restart}
            className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            ↺ 처음부터
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
            >
              {paused ? "▶ 계속" : "❚❚ 멈춤"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                if (step + 1 < stops.length) setStep(step + 1);
                else setDone(true);
              }}
              className="rounded-full bg-bg-subtle px-4 py-2 text-[14px] font-medium text-text transition hover:bg-line"
            >
              다음 ›
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full px-3 py-2 text-[14px] font-medium text-text-muted transition hover:bg-bg-subtle hover:text-text"
        >
          닫기
        </button>
      </div>
    </section>
  );
}
