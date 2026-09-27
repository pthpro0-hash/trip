"use client";

import { useEffect, type ReactNode } from "react";

/*
  지도에서 무엇을 눌렀을 때 뜨는 창.

  처음에는 아래 시트 속에 펼쳤다. 시트가 반쯤만 올라와 있어 사진이
  아래로 잘렸고, 보려면 시트 안을 굴려야 했다 — 쓰기 힘들다는 말을
  들었다. 누른 것을 보려는 순간에는 그것이 화면의 주인공이어야 한다.
  그래서 지도 위로 창을 띄운다.

  좁은 화면에서는 아래에서 올라와 화면 대부분을 쓰고, 넓은 화면에서는
  가운데 선다. 바깥을 누르거나 Esc 를 누르면 닫힌다. 사진을 크게 보는
  창(z-50)은 이 위로 뜬다.
*/

interface HubDialogProps {
  /** 읽어 주는 기계가 부를 이름. */
  label: string;
  onClose: () => void;
  children: ReactNode;
}

export function HubDialog({ label, onClose, children }: HubDialogProps) {
  useEffect(() => {
    // 창 뒤의 페이지가 따라 굴러가지 않게.
    const kept = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = kept;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // 안쪽을 누른 것까지 닫힘으로 세지 않는다.
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-surface shadow-xl md:max-h-[85vh] md:max-w-lg md:rounded-[22px]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-bg-subtle text-[16px] text-text-muted transition hover:bg-line hover:text-text"
        >
          <span aria-hidden="true">✕</span>
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-5">{children}</div>
      </div>
    </div>
  );
}
