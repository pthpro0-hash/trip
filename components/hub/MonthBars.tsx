"use client";

import { useRef, useState, type PointerEvent } from "react";
import { indexAt, rangeLabel, yearRange, type MonthRange } from "@/lib/timeline";

/*
  달마다 막대 하나. 키는 그달 찍은 사진 수다.

  손가락으로 막대 위를 쓸면 그 구간이 골라지고, 지도는 그 기간만 남긴다.
  톡 치면 그 달 하나. 해 이름을 누르면 그해 전체.

  빈 달도 바닥에 짧은 눈금을 남긴다. "이 여름엔 한 번도 안 나갔구나"는
  비어 있는 자리가 보여야 알 수 있다.
*/

interface MonthBarsProps {
  months: string[];
  totals: Map<string, number>;
  range: MonthRange | null;
  onRange: (range: MonthRange | null) => void;
}

export function MonthBars({ months, totals, range, onRange }: MonthBarsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  /** 끄는 동안의 구간. 손을 떼야 지도에 알린다 — 끄는 내내 지도가 날아다니면 어지럽다. */
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const anchor = useRef<number | null>(null);

  if (months.length === 0) return null;

  const most = Math.max(1, ...months.map((month) => totals.get(month) ?? 0));
  const shown: [number, number] | null =
    draft ??
    (range ? [months.indexOf(range[0]), months.indexOf(range[1])] : null);
  const lit = (index: number) =>
    shown !== null && index >= Math.min(...shown) && index <= Math.max(...shown);

  const at = (event: PointerEvent<HTMLDivElement>) => {
    const box = rowRef.current!.getBoundingClientRect();
    return indexAt(event.clientX - box.left, box.width, months.length);
  };

  const down = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const index = at(event);
    anchor.current = index;
    setDraft([index, index]);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (anchor.current === null) return;
    setDraft([anchor.current, at(event)]);
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (anchor.current === null) return;
    const from = Math.min(anchor.current, at(event));
    const to = Math.max(anchor.current, at(event));
    anchor.current = null;
    setDraft(null);

    // 이미 고른 한 달을 다시 톡 치면 푼다.
    const same = range && range[0] === months[from] && range[1] === months[to];
    onRange(same && from === to ? null : [months[from], months[to]]);
  };

  /** 해가 시작되는 막대 자리. 해 이름을 그 위에 단다. */
  const years = months
    .map((month, index) => ({ year: month.slice(0, 4), index }))
    .filter((entry, i, all) => i === 0 || all[i - 1].year !== entry.year);

  return (
    <div data-no-drag className="select-none">
      <div
        ref={rowRef}
        role="group"
        aria-label="달마다 찍은 사진. 끌어서 기간을 고르세요"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          anchor.current = null;
          setDraft(null);
        }}
        className="flex h-9 cursor-pointer touch-none items-end gap-[2px]"
      >
        {months.map((month, index) => {
          const photos = totals.get(month) ?? 0;
          return (
            <span
              key={month}
              title={`${month.replace("-", ".")} · 사진 ${photos}장`}
              className={`min-w-[2px] flex-1 rounded-t-[2px] transition-colors ${
                lit(index) ? "bg-accent" : photos > 0 ? "bg-line-strong" : "bg-line"
              }`}
              style={{ height: photos > 0 ? `${Math.max(14, (photos / most) * 100)}%` : "3px" }}
            />
          );
        })}
      </div>

      <div className="relative mt-1 flex h-5 items-center">
        {years.map(({ year, index }) => {
          const whole = yearRange(months, year);
          const on = whole !== null && range !== null && range[0] === whole[0] && range[1] === whole[1];
          return (
            <button
              key={year}
              type="button"
              onClick={() => onRange(on ? null : whole)}
              aria-pressed={on}
              className={`absolute rounded px-1 text-[11px] font-medium tabular-nums transition ${
                on ? "bg-accent-soft text-accent" : "text-text-faint hover:text-text"
              }`}
              style={{ left: `${(index / months.length) * 100}%` }}
            >
              {year}
            </button>
          );
        })}
        {range && (
          <button
            type="button"
            onClick={() => onRange(null)}
            className="ml-auto text-[11px] font-medium text-accent hover:text-accent-hover"
          >
            {rangeLabel(range)} · 풀기
          </button>
        )}
      </div>
    </div>
  );
}
