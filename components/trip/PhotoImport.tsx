"use client";

import { useMemo, useRef, useState } from "react";
import { readShots, type ReadResult } from "@/lib/photo/readShots";
import { dayKey, findLivingArea, groupIntoTrips, tripDays } from "@/lib/photo/grouping";
import type { Shot, Trip } from "@/lib/photo/types";

interface PlaceAnswer {
  title: string;
  isCuratedSpot: boolean;
  dong: string | null;
}

interface Stage {
  name: "idle" | "reading" | "naming" | "ready" | "failed";
  done?: number;
  total?: number;
  message?: string;
}

const PLACE_BATCH = 25;

function hourMinute(date: Date) {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

async function fetchPlaces(points: { lat: number; lng: number }[]): Promise<PlaceAnswer[]> {
  const answers: PlaceAnswer[] = [];
  for (let start = 0; start < points.length; start += PLACE_BATCH) {
    const response = await fetch("/api/place", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: points.slice(start, start + PLACE_BATCH) }),
    });
    if (!response.ok) throw new Error("place lookup failed");
    const body: { places: PlaceAnswer[] } = await response.json();
    answers.push(...body.places);
  }
  return answers;
}

export function PhotoImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ name: "idle" });
  const [read, setRead] = useState<ReadResult | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [places, setPlaces] = useState<PlaceAnswer[]>([]);
  const [dailyShots, setDailyShots] = useState<Shot[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const visible = useMemo(
    () => trips.map((trip, index) => ({ trip, index })).filter(({ index }) => !dismissed.has(index)),
    [trips, dismissed],
  );

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setDismissed(new Set());
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
      const points = grouped.flatMap((trip) =>
        trip.visits.map((visit) => ({ lat: visit.shots[0].lat, lng: visit.shots[0].lng })),
      );
      setPlaces(await fetchPlaces(points));
      setStage({ name: "ready" });
    } catch {
      // 이름을 못 붙여도 언제 어디를 몇 장 찍었는지는 보여줄 수 있다.
      setPlaces([]);
      setStage({ name: "ready", message: "장소 이름을 가져오지 못했어요. 날짜와 사진은 그대로예요." });
    }
  };

  /** 여러 여행에 걸쳐 방문이 이어져 있어, 몇 번째 방문인지 세어 이름을 찾는다. */
  const placeFor = (tripIndex: number, visitIndex: number) => {
    let offset = 0;
    for (let i = 0; i < tripIndex; i += 1) offset += trips[i].visits.length;
    return places[offset + visitIndex];
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
        {visible.map(({ trip, index }) => {
          const days = tripDays(trip);
          const span = days.length > 1 ? `${days[0]} ~ ${days.at(-1)}` : days[0];
          return (
            <li key={index} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[17px] font-semibold tracking-tight text-text">{span}</p>
                  <p className="mt-0.5 text-[13px] text-text-faint">
                    사진 {trip.shots.length}장 · 방문 {trip.visits.length}곳
                    {days.length > 1 && ` · ${days.length}일`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissed(new Set(dismissed).add(index))}
                  className="shrink-0 rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-line"
                >
                  일상이에요
                </button>
              </div>

              <ul className="flex flex-col gap-2">
                {trip.visits.map((visit, visitIndex) => {
                  const place = placeFor(index, visitIndex);
                  const first = visit.shots[0].takenAt;
                  const last = visit.shots.at(-1)!.takenAt;
                  return (
                    <li key={visitIndex} className="flex items-baseline gap-2 text-[15px]">
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
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {visible.length > 0 && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[13px] leading-relaxed text-text-muted">
          지금은 찾은 결과를 보여드리는 데까지예요. 누구와 갔는지 적고 기록으로 남기는 건 다음에
          붙입니다.
        </p>
      )}
    </>
  );
}
