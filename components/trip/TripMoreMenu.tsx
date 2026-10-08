"use client";

import { useEffect, useRef, useState } from "react";

/*
  여행 상세의 "⋯" — 눌러야 나오는 단추들. 지금은 "이 여행 지우기" 하나다.

  전에는 링크 공유 · 엽서 보내기 · 이 여행 지우기가 같은 크기로 나란히 있었다. 지우기가 공유 바로 옆이라 손이 미끄러질
  자리이고, 되돌릴 수 없는 일이 평범한 일과 같은 무게로 보였다. 사진을 다 훑어 내려간 끝에서 지우기를 만나면 손이
  미끄러진다는 이유로 맨 아래가 아니라 위에 두었던 것인데, 이제는 위에 있되 한 번 펼쳐야 보인다.

  누른 뒤에도 한 번 더 묻는 것은 그대로다: 처음 누르면 "정말 지울까요? 사진도 함께 사라져요"(엽서를 보냈으면 그 수도)로
  바뀌고, 한 번 더 눌러야 지운다. 손을 떼거나 메뉴를 닫으면 묻던 것을 거둔다. 묻는 상태와 지우는 일은 부르는 쪽이 쥔다.
*/

interface TripMoreMenuProps {
  /** 지우기를 한 번 눌러 "정말?" 하고 묻는 중인가. */
  confirming: boolean;
  /** 지우는 중인가. */
  removing: boolean;
  /** 묻는 중에 단추에 적을 말. 사진과 보낸 엽서가 함께 사라진다는 것을 알린다. */
  confirmText: string;
  /** 지우기를 눌렀다 — 묻기 시작한다. */
  onAsk: () => void;
  /** 한 번 더 눌렀다 — 지운다. */
  onConfirm: () => void;
  /** 묻던 것을 거둔다(손을 뗐거나 메뉴를 닫았다). */
  onCancel: () => void;
}

export function TripMoreMenu({ confirming, removing, confirmText, onAsk, onConfirm, onCancel }: TripMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    onCancel();
  };

  // 열려 있는 동안만 바깥을 누르거나 Esc 를 누르면 닫는다.
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
    // close 는 부르는 쪽의 onCancel 만 쓴다. 다시 그릴 때마다 구독을 갈아 끼울 까닭이 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label="더 보기"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="grid h-10 w-10 place-items-center rounded-full bg-bg-subtle text-text-muted ring-1 ring-line transition hover:bg-line hover:text-text"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div
          role="group"
          aria-label="더 보기"
          className="absolute right-0 top-full z-10 mt-2 w-[min(280px,calc(100vw-40px))] rounded-2xl bg-surface p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.18)] ring-1 ring-line"
        >
          <button
            type="button"
            onClick={() => (confirming ? onConfirm() : onAsk())}
            onBlur={() => {
              if (confirming) onCancel();
            }}
            disabled={removing}
            className={`w-full rounded-xl px-3.5 py-3 text-left text-[14px] font-medium leading-snug transition disabled:opacity-60 ${
              confirming ? "bg-[#d70015] text-white" : "text-text hover:bg-bg-subtle"
            }`}
          >
            {removing ? "지우는 중…" : confirming ? confirmText : "이 여행 지우기"}
          </button>
        </div>
      )}
    </div>
  );
}
