"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MAP_HREF, SKETCH_HREF } from "@/lib/nav";
import type { SaveOutcome } from "./types";

/*
  기록이 끝난 뒤의 화면.

  예전에는 목록 위에 작은 안내 상자가 떴고 그 아래에 방금 기록한 카드들이 그대로 남아 있었다. 끝난 것인지
  아닌지 알기 어렵고, 다음에 무엇을 하면 좋을지 알려 주는 곳이 "내 여행 보기 →" 글자 하나뿐이었다. 끝났다고
  크게 말하고, 결과가 어디에서 보이는지 둘을 건넨다.
*/

const PRIMARY =
  "flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-[16px] font-semibold text-on-accent transition hover:bg-accent-hover";
const SECONDARY =
  "flex w-full items-center justify-center rounded-full bg-surface px-6 py-3 text-[15px] font-medium text-text ring-1 ring-line transition hover:bg-bg";

interface DoneViewProps {
  outcome: SaveOutcome;
  /** 사진을 더 고른다. */
  onMore: () => void;
  /** 저장하지 못한 여행을 다시 기록해 본다(확인 화면으로 돌아간다). 실패가 없으면 부르지 않는다. */
  onRetry?: () => void;
}

export function DoneView({ outcome, onMore, onRetry }: DoneViewProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  // 긴 목록 아래에서 눌렀어도 결과가 맨 위에서 보이고, 화면 읽기 도구가 결과부터 읽는다.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, []);

  const lines: string[] = [];
  if (outcome.photos > 0) lines.push(`사진 ${outcome.photos}장을 ${outcome.saved > 0 ? "함께 올렸어요" : "더했어요"}`);
  if (outcome.merged > 0 && outcome.saved > 0) lines.push(`기존 여행 ${outcome.merged}건에는 새 사진만 더했어요`);
  if (outcome.duplicates > 0) lines.push(`이미 있던 사진 ${outcome.duplicates}장은 건너뛰었어요`);
  if (outcome.skipped > 0) lines.push(`이미 있던 ${outcome.skipped}건은 건너뛰었어요`);
  if (outcome.failed > 0) lines.push(`${outcome.failed}건은 저장하지 못했어요`);
  if (outcome.unsupported.length > 0) {
    lines.push(
      `${outcome.unsupported.length}장은 이 브라우저가 열지 못하는 형식이라 올리지 못했어요. 기록 자체는 남아 있어요.`,
    );
  }
  if (outcome.overLimit > 0) lines.push(`보관할 수 있는 사진 수를 넘어 ${outcome.overLimit}장은 올리지 못했어요`);

  return (
    <section className="flex flex-col items-center gap-5 rounded-2xl bg-bg-subtle px-6 py-10 text-center">
      {(outcome.saved > 0 || outcome.merged > 0) && (
        <span aria-hidden="true" className="grid h-14 w-14 place-items-center rounded-full bg-accent-soft text-accent">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}

      <div className="flex flex-col gap-2">
        <h2 ref={heading} tabIndex={-1} className="text-[22px] font-bold tracking-tight text-text outline-none">
          {outcome.saved > 0
            ? `여행 ${outcome.saved}건을 기록했어요`
            : outcome.merged > 0
              ? `기존 여행 ${outcome.merged}건에 사진을 더했어요`
              : "새로 기록한 여행이 없어요"}
        </h2>
        {lines.length > 0 && (
          <ul className="flex flex-col gap-1 break-keep text-[14px] leading-relaxed text-text-muted">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex w-full flex-col gap-2.5 sm:max-w-xs">
        <Link href={MAP_HREF} className={PRIMARY}>
          지도에서 보기
        </Link>
        <Link href={SKETCH_HREF} className={SECONDARY}>
          한장 요약 보기
        </Link>
        {outcome.failed > 0 && onRetry && (
          <button type="button" onClick={onRetry} className={SECONDARY}>
            다시 기록해 보기
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onMore}
        className="text-[14px] font-medium text-text-muted underline underline-offset-2 transition hover:text-text"
      >
        사진 더 고르기
      </button>
    </section>
  );
}
