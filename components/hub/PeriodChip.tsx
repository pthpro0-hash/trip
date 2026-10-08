"use client";

import { rangeLabel, type MonthRange } from "@/lib/timeline";

/*
  "기간" 단추 — 달 막대(MonthBars)를 여닫는다.

  달 막대는 시트 머리를 가득 채우는 낯선 그림이었고, 살짝 올린 처음 모습에서는 여행 카드가 보일 자리를 차지했다.
  막대를 이 단추 뒤로 접는다. 접혀 있어도 지금 어떤 기간으로 보고 있는지는 단추가 말한다 — 거른 기간이 있으면 켜진
  모습으로 보여, 목록이 왜 이것뿐인지 알 수 있다.
*/

interface PeriodChipProps {
  /** 달 막대로 고른 기간. 없으면 전체. */
  range: MonthRange | null;
  /** 달 막대가 펼쳐져 있는가. */
  open: boolean;
  onToggle: () => void;
}

export function PeriodChip({ range, open, onToggle }: PeriodChipProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
        range ? "bg-accent-soft text-accent" : "bg-bg-subtle text-text hover:bg-line"
      }`}
    >
      기간 {range ? rangeLabel(range) : "전체"}
      <span aria-hidden="true" className={`text-[11px] transition ${open ? "rotate-180" : ""}`}>
        ▾
      </span>
    </button>
  );
}
