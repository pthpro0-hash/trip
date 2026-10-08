"use client";

import { Fragment, useId, useState } from "react";
import { TripThumbs } from "./TripThumbs";
import type { VisitLine } from "./types";

/*
  확인 화면의 여행 카드 하나.

  사진을 고른 사람이 가장 먼저 하는 일은 "이게 내 어느 여행이지?" 알아보는 것이다. 카드는 그것을 먼저
  보여 주고(제목 · 기간 · 작은 그림), 곳 목록 · 동행 · 나누기 · 합치기는 "다듬기" 안으로 접는다 — 대부분의
  사람은 그것을 건드리지 않고 지나간다. 다듬을 만한 것이 있으면(멀리 떨어진 날 경계, 합칠 수 있는 이웃 여행)
  접힌 단추에 "제안 N" 으로 알려, 열어 볼 까닭을 준다.

  이 카드는 보여 주기만 한다. 제목 · 동행 · 나누기 · 합치기가 실제로 무엇을 바꾸는지는 부르는 쪽(PhotoImport)이 정한다.
*/

export interface TripCardProps {
  title: string;
  onTitle: (next: string) => void;
  /** 사람이 읽는 기간. "2026년 9월 13일 ~ 14일". */
  span: string;
  photos: number;
  places: number;
  /** 작은 그림으로 쓸 사진(원본 파일). 없으면 그림 자리를 두지 않는다. */
  files: File[];
  visits: VisitLine[];
  companions: string;
  onCompanions: (next: string) => void;
  /** 고칠 수 있는가 — 로그인했고 아직 기록하지 않은 여행. */
  editable: boolean;
  /** 같은 날짜에 이미 기록한 여행이 있다. */
  alreadySaved: boolean;
  /** 바로 위 여행과 한 여행이었을 수 있다. */
  canMergeUp: boolean;
  onMergeUp: () => void;
  onSplit: (day: string) => void;
  /** 여행이 아니라고 뺀다(집 근처 나들이, 일상). */
  onDismiss: () => void;
}

function Pencil() {
  return (
    <svg
      data-icon="pencil"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M14.5 7.5l3 3" />
    </svg>
  );
}

export function TripCard({
  title,
  onTitle,
  span,
  photos,
  places,
  files,
  visits,
  companions,
  onCompanions,
  editable,
  alreadySaved,
  canMergeUp,
  onMergeUp,
  onSplit,
  onDismiss,
}: TripCardProps) {
  const [open, setOpen] = useState(false);
  const panel = useId();

  // 다듬을 만한 자리: 멀리 떨어진 날 경계마다 하나, 위 여행과 합칠 수 있으면 하나. 고칠 수 없는 카드는 제안도 없다.
  const suggestions = editable ? visits.filter((line) => line.cut).length + (canMergeUp ? 1 : 0) : 0;

  // 사진이 바뀌면(나누기 · 합치기) 작은 그림 칸을 새로 시작한다.
  const thumbsKey = files.map((file) => file.name).join("|");

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="min-w-0">
        {editable ? (
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(event) => onTitle(event.target.value)}
              placeholder="이 여행의 이름"
              aria-label="여행 제목"
              className="w-full rounded-lg bg-bg-subtle py-1.5 pl-2.5 pr-8 text-[17px] font-semibold tracking-tight text-text outline-none transition placeholder:font-normal placeholder:text-text-faint focus:ring-2 focus:ring-accent"
            />
            <Pencil />
          </div>
        ) : (
          <p className="text-[17px] font-semibold tracking-tight text-text">{title || span}</p>
        )}
        <p className="mt-1.5 text-[13px] text-text-faint">
          {span} · 사진 {photos}장 · 방문 {places}곳
        </p>
        {alreadySaved && <p className="mt-0.5 text-[13px] text-text-faint">이미 기록한 날짜와 겹쳐요.</p>}
      </div>

      {files.length > 0 && <TripThumbs key={thumbsKey} files={files} />}

      <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panel : undefined}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-full py-1 pr-1 text-[14px] font-medium text-text-muted transition hover:text-text"
        >
          {editable ? "다듬기" : "방문한 곳 보기"}
          {suggestions > 0 && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent">
              제안 {suggestions}
            </span>
          )}
          <span aria-hidden="true" className={`text-[12px] transition ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-line"
        >
          여행 아님
        </button>
      </div>

      {open && (
        <div id={panel} className="flex flex-col gap-3">
          {editable && canMergeUp && (
            <button
              type="button"
              onClick={onMergeUp}
              className="self-start rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-line"
            >
              ↑ 위 여행과 한 여행이었어요
            </button>
          )}

          <ul className="flex flex-col gap-2">
            {visits.map((line) => (
              <Fragment key={line.id}>
                {editable && line.cut && (
                  <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-bg-subtle px-3 py-2 text-[13px] text-text-muted">
                    <span>여기서 날이 바뀌고 {Math.round(line.cut.km)}km 떨어져요.</span>
                    <button
                      type="button"
                      onClick={() => onSplit(line.cut!.day)}
                      className="font-medium text-accent transition hover:text-accent-hover"
                    >
                      따로 기록하기
                    </button>
                  </li>
                )}
                <li className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                  <span aria-hidden="true" className="text-text-faint">
                    ▸
                  </span>
                  <span className="font-medium text-text">{line.title}</span>
                  {line.curated && (
                    <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                      100선
                    </span>
                  )}
                  <span className="text-[13px] text-text-faint">{line.when}</span>
                </li>
              </Fragment>
            ))}
          </ul>

          {editable && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-text-faint">누구와 가셨나요?</span>
              <input
                type="text"
                value={companions}
                onChange={(event) => onCompanions(event.target.value)}
                placeholder="예: 가족, 민수, 혼자"
                className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * "여행 아님" 으로 뺀 여행의 자리. 목록에서 사라지기만 하면 눌러서 잃은 것을 되찾을 길이 없다 —
 * 같은 자리에 얇은 줄을 남겨 되돌릴 수 있게 한다.
 */
export function DismissedTrip({ title, onUndo }: { title: string; onUndo: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-bg-subtle px-4 py-2.5 text-[14px] text-text-muted">
      <span className="min-w-0 truncate">‘{title}’을 뺐어요</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 font-medium text-accent transition hover:text-accent-hover"
      >
        되돌리기
      </button>
    </div>
  );
}
