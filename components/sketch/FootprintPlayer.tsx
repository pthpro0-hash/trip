"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { project } from "@/lib/koreaMap";
import { sidoShapes } from "@/lib/sidoShapes";
import { dotsViewBox } from "@/lib/photo/regionView";
import { SEASON_COLOR } from "@/lib/sketch";
import { tripFocus } from "@/lib/scrollMemory";
import {
  dotLook,
  initialPlay,
  labelOf,
  playReducer,
  seasonOfMonth,
  stepDelayMs,
  stepTitle,
  tripsPerMonth,
  type FootprintStep,
} from "@/lib/footprint";

/*
  발자취 — 한 해를 날짜순으로 지도에 찍어 본다.

  카드는 그해를 한눈에 보여 주고, 여기서는 그 순서를 되살린다. 곳을 하나씩 찍으며
  지금 곳은 크게, 지나온 곳은 작게 남긴다(선은 잇지 않는다). 아래 달 막대를 누르면
  그 달에 다녀온 곳만 남는다. 곳마다 1초씩 머문다.

  내 화면에서는 점을 눌러 그 여행으로 갈 수 있다. 링크로 받은 화면(shared)에는
  갈 곳이 없어 점을 눌러도 이름만 보인다.
*/

const FRAME = { width: 340, height: 400 };
const SEA = "#dbeafe";
const LAND = "#f5f3ec";
const COAST = "#b6c6d2";
const BAR_MAX = 44;

interface FootprintPlayerProps {
  steps: FootprintStep[];
  /** 1월부터 열두 칸, 그 달의 여행 수. */
  monthCounts: number[];
  totals: { trips: number; places: number; photos: number };
  /** 곳의 대표 사진 주소(보관 경로 → 주소). */
  photoUrls?: Map<string, string>;
  /** 링크로 받은 화면. 점을 눌러도 상세로 가지 않는다. */
  shared?: boolean;
  /** 상세에서 돌아올 자리. */
  backHref?: string;
  /** 위 제목. 한 해가 아니라 여행 하나를 보일 때(엽서)는 "다녀온 길"처럼 바꾼다. */
  heading?: string;
  hint?: string;
  /** 아래 달 막대를 둘지. 여행 하나(엽서)에는 달을 고를 일이 없다. */
  showMonths?: boolean;
}

/** 점 위의 이름표. 가장자리에서는 안쪽으로 밀어 잘리지 않게 한다. */
function MapTag({
  text,
  x,
  y,
  k,
  view,
}: {
  text: string;
  x: number;
  y: number;
  k: number;
  view: { x: number; y: number; width: number; height: number };
}) {
  const size = 13 * k;
  const half = (text.length * size * 0.62 + 16 * k) / 2;
  const cx = Math.min(Math.max(x, view.x + half + 4 * k), view.x + view.width - half - 4 * k);
  // 위쪽이 모자라면 점 아래에 둔다.
  const above = y - view.y > 40 * k;
  const cy = above ? y - 24 * k : y + 34 * k;
  return (
    <g pointerEvents="none" data-tag>
      <rect x={cx - half} y={cy - size} width={half * 2} height={size * 1.7} rx={size * 0.5} fill="#fff" fillOpacity={0.94} stroke={COAST} strokeWidth={k} />
      <text x={cx} y={cy + size * 0.2} textAnchor="middle" fontSize={size} fontWeight={700} fill="#222">
        {text}
      </text>
    </g>
  );
}

export function FootprintPlayer({ steps, monthCounts, totals, photoUrls, shared = false, backHref, heading = "그해의 발자취", hint = "날짜순으로 찍어 봐요", showMonths = true }: FootprintPlayerProps) {
  const [state, dispatch] = useReducer(playReducer, initialPlay);
  const [picked, setPicked] = useState<number | null>(null);
  const count = steps.length;
  const delay = stepDelayMs();

  // 재생 중에는 한 곳씩 넘긴다.
  useEffect(() => {
    if (!state.playing) return;
    const timer = setTimeout(() => dispatch({ type: "tick", count }), delay);
    return () => clearTimeout(timer);
  }, [state.playing, state.cur, count, delay]);

  const view = useMemo(() => dotsViewBox(steps, FRAME), [steps]);
  const k = view.width / FRAME.width;
  const points = useMemo(() => steps.map((step) => project(step.lat, step.lng)), [steps]);
  const barMax = Math.max(1, ...monthCounts);
  const label = labelOf(steps, state, monthCounts, totals);
  // 방문이 있는 달만 누를 수 있다.
  const perMonth = monthCounts.length === 12 ? monthCounts : tripsPerMonth(steps);

  if (count === 0) return null;

  const hasAny = (month: number) => steps.some((step) => step.month === month);
  const shown = picked !== null ? steps[picked] : null;
  const shownPhoto = shown?.photoPath ? photoUrls?.get(shown.photoPath) : undefined;
  const canPlay = !state.playing;
  const tagIndex = picked ?? (state.sel === null && state.cur >= 0 && !state.done ? state.cur : null);

  return (
    <section aria-label="발자취" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold tracking-tight text-text">{heading}</h2>
        <span className="text-[13px] text-text-faint">{hint}</span>
      </div>

      <div className="overflow-hidden rounded-2xl ring-1 ring-line" style={{ background: SEA }}>
        <svg
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          role="img"
          aria-label="다녀온 곳 지도"
          className="block w-full"
          style={{ aspectRatio: `${FRAME.width} / ${FRAME.height}` }}
        >
          <rect x={view.x} y={view.y} width={view.width} height={view.height} fill={SEA} />
          {/* 도 경계가 보이는 간략한 실제 지도. 흐리게 깔아 점과 이름표가 먼저 읽히게 한다. */}
          <g opacity={0.5} data-basemap>
            {sidoShapes().list.map((sido) => (
              <path key={sido.name} d={sido.d} fillRule="evenodd" fill={LAND} stroke={COAST} strokeWidth={0.9 * k} strokeLinejoin="round" />
            ))}
          </g>
          {steps.map((step, index) => {
            const look = dotLook(index, step, state);
            const point = points[index];
            if (look.r === 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
            const color = SEASON_COLOR[seasonOfMonth(step.month)];
            return (
              <g
                key={index}
                data-dot={index}
                onClick={() => setPicked(picked === index ? null : index)}
                style={{ cursor: "pointer" }}
              >
                {look.ring > 0 && <circle cx={point.x} cy={point.y} r={look.ring * k} fill={color} fillOpacity={0.22} />}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={look.r * k}
                  fill={color}
                  fillOpacity={look.opacity}
                  stroke="#fff"
                  strokeWidth={1.5 * k}
                />
                {/* 작은 점도 손가락으로 누를 수 있게 넉넉한 자리를 덮는다. */}
                <circle cx={point.x} cy={point.y} r={14 * k} fill="transparent" />
              </g>
            );
          })}
          {/* 지금 찍는 곳(재생 중)이나 눌러 본 곳의 날짜·이름을 그 점 위에 적는다. */}
          {tagIndex !== null && Number.isFinite(points[tagIndex]?.x) && (
            <MapTag text={stepTitle(steps[tagIndex])} x={points[tagIndex].x} y={points[tagIndex].y} k={k} view={view} />
          )}
        </svg>

        <div className="flex items-center gap-3 bg-bg px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-text">{label.title}</p>
            <p className="truncate text-[13px] text-text-muted">{label.sub}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!canPlay) return dispatch({ type: "pause" });
                setPicked(null);
                dispatch({ type: "play", count });
              }}
              className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
            >
              {state.playing ? "멈춤" : state.done || state.sel !== null ? "다시 재생" : state.cur >= 0 ? "이어서" : "재생"}
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "skip", count })}
              aria-label="끝으로"
              className="rounded-full bg-bg-subtle px-3 py-2 text-[14px] font-medium text-text-muted transition hover:bg-line"
            >
              끝으로
            </button>
          </div>
        </div>
      </div>

      {shown && (
        <div className="flex items-center gap-3 rounded-2xl bg-bg-subtle p-3">
          {shownPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownPhoto} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-text">{stepTitle(shown)}</p>
            <p className="text-[13px] text-text-muted">사진 {shown.photoCount}장</p>
          </div>
          {!shared && shown.tripId && (
            <Link
              href={`/trips/${shown.tripId}`}
              onClick={() => backHref && tripFocus.rememberFrom(backHref)}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
            >
              상세 보기
            </Link>
          )}
        </div>
      )}

      {/* 달마다 여행이 몇 번이었는지. 누르면 그 달에 간 곳만 지도에 남는다. */}
      {showMonths && (
      <div role="group" aria-label="달별 여행 수" className="flex items-end gap-1">
        {perMonth.map((n, index) => {
          const month = index + 1;
          const on = state.sel === month;
          const enabled = hasAny(month);
          return (
            <button
              key={month}
              type="button"
              disabled={!enabled}
              aria-pressed={on}
              aria-label={`${month}월 여행 ${n}번`}
              onClick={() => {
                setPicked(null);
                dispatch({ type: "month", month });
              }}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:opacity-40"
            >
              <span className="text-[12px] font-medium text-text-muted">{n > 0 ? n : ""}</span>
              <span
                className="w-full rounded-t-md"
                style={{
                  height: n > 0 ? Math.max(6, Math.round((n / barMax) * BAR_MAX)) : 3,
                  background: n > 0 ? SEASON_COLOR[seasonOfMonth(month)] : "#ececec",
                  opacity: state.sel === null || on ? 1 : 0.35,
                }}
              />
              <span className={`text-[12px] ${on ? "font-bold text-text" : "text-text-faint"}`}>{month}</span>
            </button>
          );
        })}
      </div>
      )}
    </section>
  );
}
