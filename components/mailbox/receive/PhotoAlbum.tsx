"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";

/*
  책 한 권의 사진을 한 장씩 넘겨 본다.

  한 번에 한 장만 크게 보이고(길게 늘어놓으면 스무 장이 한 화면을 다 먹는다), 큰 단추와 손가락 밀기와 화살표
  키로 넘긴다. 곁의 한 장씩만 미리 받아 둔다 — 스무 장을 한꺼번에 받으면 부모님 폰의 데이터를 쓴다.
  지워진 사진(보낸 분이 원본을 지우면 복사본도 지워진다)은 그 쪽만 안내로 바뀌고, 다른 쪽은 계속 넘겨 볼 수 있다.
*/

/** 이만큼(px) 가로로 밀면 넘긴다. 세로로 더 많이 움직였으면 화면을 굴리려던 것이라 넘기지 않는다. */
const SWIPE = 40;

export function PhotoAlbum({ postcardId, files }: { postcardId: string; files: string[] }) {
  const [index, setIndex] = useState(0);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = files.length - 1;

  // 곁의 한 장씩 미리 받는다.
  useEffect(() => {
    for (const around of [index - 1, index + 1]) {
      const file = files[around];
      if (file) new Image().src = postcardFileUrl(postcardId, file);
    }
  }, [index, files, postcardId]);

  if (files.length === 0) return null;

  const go = (step: number) => setIndex((current) => Math.min(last, Math.max(0, current + step)));
  const file = files[index];

  const down = (event: PointerEvent<HTMLDivElement>) => {
    start.current = { x: event.clientX, y: event.clientY };
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(1);
    if (event.key === "ArrowLeft") go(-1);
  };

  const arrow =
    "absolute top-1/2 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-[26px] text-white backdrop-blur-sm transition disabled:opacity-0";

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="사진 앨범"
        tabIndex={0}
        onPointerDown={down}
        onPointerUp={up}
        onKeyDown={key}
        // 세로로 굴리는 것은 브라우저에 맡기고, 가로로 미는 것만 우리가 받는다.
        style={{ touchAction: "pan-y" }}
        className="relative select-none overflow-hidden rounded-3xl bg-bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {gone.has(file) ? (
          <div className="grid aspect-[4/3] w-full place-items-center px-6 text-center rs-17 leading-relaxed text-text-muted">
            보낸 분이 이 사진을 지웠어요
          </div>
        ) : (
          // 우리 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file}
            src={postcardFileUrl(postcardId, file)}
            alt=""
            draggable={false}
            onError={() => setGone((current) => new Set(current).add(file))}
            className="aspect-[4/3] w-full object-cover"
          />
        )}

        {files.length > 1 && (
          <>
            <button type="button" aria-label="이전 사진" disabled={index === 0} onClick={() => go(-1)} className={`${arrow} left-2`}>
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" aria-label="다음 사진" disabled={index === last} onClick={() => go(1)} className={`${arrow} right-2`}>
              <span aria-hidden="true">›</span>
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 rs-16 font-medium text-white">
              {index + 1} / {files.length}
            </span>
          </>
        )}
      </div>
      {files.length > 1 && <p className="rs-14 text-center text-text-faint">옆으로 밀거나 화살표를 눌러 한 장씩 넘겨 보세요</p>}
    </div>
  );
}
