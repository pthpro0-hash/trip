"use client";

import { useId, useState } from "react";

/*
  엽서에 실을 사진.

  사진은 자동으로 골라 둔다(곳마다 골고루, 책장 설정의 장수까지). 사람 대부분은 그대로 보내는데, 예전에는 스무 장 가까운
  사진 격자가 창 맨 위를 차지했다. 접어 두고 "사진 12장을 골라 뒀어요 · 바꾸기"로 말한다 — 바꾸고 싶은 사람만 연다.
  무엇을 골랐는지는 위의 엽서 미리보기(첫 사진)가 보여 준다.
*/

interface PhotoPickerProps {
  /** 이 여행의 사진들. */
  photos: { id: string; storagePath: string }[];
  /** 원본 보관 경로 → 목록 판 주소. */
  urls: Map<string, string>;
  /** 지금 고른 사진 id(실리는 차례대로). */
  picked: string[];
  /** 실을 수 있는 최대 장수. */
  limit: number;
  /** 한도가 줄어든 까닭(책장 설정). 없으면 null. */
  limitNote: string | null;
  /** 손으로 고쳤는가 — 그러면 추천으로 되돌리는 길을 낸다. */
  manual: boolean;
  onToggle: (id: string) => void;
  onReset: () => void;
}

export function PhotoPicker({ photos, urls, picked, limit, limitNote, manual, onToggle, onReset }: PhotoPickerProps) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  // 엽서에는 여행 차례대로 실린다(sendPostcard). 번호도 고른 차례가 아니라 그 차례다.
  const order = photos.filter((photo) => picked.includes(photo.id)).map((photo) => photo.id);

  if (photos.length === 0) {
    return <p className="text-[13px] text-text-faint">이 여행에는 사진이 없어요. 글과 지도만 가요.</p>;
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-text-muted">
          {picked.length > 0 ? `사진 ${picked.length}장을 골라 뒀어요` : "사진을 고르지 않았어요 — 글과 지도만 가요"}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panel : undefined}
          aria-label={open ? "사진 접기" : "사진 바꾸기"}
          onClick={() => setOpen(!open)}
          className="shrink-0 text-[13px] font-medium text-accent transition hover:text-accent-hover"
        >
          {open ? "접기" : "바꾸기"}{" "}
          <span aria-hidden="true" className="text-[11px]">
            {open ? "▴" : "▾"}
          </span>
        </button>
      </div>

      {open && (
        <div id={panel} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-text">
              사진{" "}
              <span className="font-normal text-text-muted">
                {picked.length}/{limit}
              </span>
            </h3>
            {manual && (
              <button type="button" onClick={onReset} className="text-[12px] font-medium text-accent hover:text-accent-hover">
                추천으로 고르기
              </button>
            )}
          </div>
          {limitNote && <p className="text-[12px] leading-relaxed text-text-faint">{limitNote}</p>}
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {photos.map((photo) => {
              const on = picked.includes(photo.id);
              const url = urls.get(photo.storagePath);
              return (
                <button
                  key={photo.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? "엽서에서 빼기" : "엽서에 넣기"}
                  onClick={() => onToggle(photo.id)}
                  disabled={!on && picked.length >= limit}
                  className={`relative aspect-square overflow-hidden rounded-lg bg-bg-subtle ring-2 transition disabled:opacity-40 ${
                    on ? "ring-accent" : "ring-transparent"
                  }`}
                >
                  {url && (
                    // 서명 주소는 그때그때 바뀐다.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {on && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                      {order.indexOf(photo.id) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
