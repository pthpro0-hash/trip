"use client";

import { useEffect } from "react";

/*
  사진 한 장을 화면 가득.

  더 큰 판을 따로 만들지 않는다. 보관해 둔 것이 이미 긴 변 2048px 이라
  웬만한 화면을 채우고도 남는다. 목록에서는 480px 짜리 작은 판을 쓰지만
  여기서는 보관본을 그대로 불러온다 — 열어 본 것만 받으므로 낭비가 없다.

  잘라내지 않는다(object-contain). 세로 사진이 가로 화면에서 위아래가
  잘리면 정작 찍은 것이 사라진다.
*/

interface PhotoViewerProps {
  /** 아직 주소를 받아오는 중이면 null. */
  url: string | null;
  /** 지금 몇 번째인지. 사람이 세는 대로 1부터. */
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function PhotoViewer({ url, index, total, onClose, onPrev, onNext }: PhotoViewerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);

    // 뒤에 깔린 목록이 같이 굴러다니면 어지럽다.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`사진 ${index}/${total} 크게 보기`}
      // 바깥을 누르면 닫힌다. 사진 자체를 누른 것은 아래에서 막는다.
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4"
    >
      {url ? (
        // 보관함의 서명 주소라 그때그때 달라진다. next/image 로 미리
        // 최적화할 수 없다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        <p className="text-[15px] text-white/70">불러오는 중…</p>
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-[20px] text-white backdrop-blur-sm transition hover:bg-white/30"
      >
        ✕
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPrev();
            }}
            aria-label="이전 사진"
            className="absolute left-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-[22px] text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            aria-label="다음 사진"
            className="absolute right-3 grid h-12 w-12 place-items-center rounded-full bg-white/15 text-[22px] text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            ›
          </button>
          <p className="absolute bottom-5 text-[14px] font-medium text-white/80">
            {index} / {total}
          </p>
        </>
      )}
    </div>
  );
}
