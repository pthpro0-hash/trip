"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

/*
  지도 위로 올라오는 시트.

  세 칸에서 멈춘다. 살짝(요약과 여행 카드), 반쯤(여행 목록), 끝까지(사진).
  지도를 보고 싶으면 내리고, 목록을 보고 싶으면 올린다 — 화면을 둘로
  나누지 않고 한 장을 사람이 원하는 만큼 덮는다.

  손잡이와 머리만 끌린다. 속까지 끌리게 하면 목록을 굴리려던 손이
  시트를 끌어내리고, 시트를 끌려던 손이 목록을 굴린다. 둘이 다투지 않게
  나눠 둔다.
*/

export type Snap = "peek" | "half" | "full";

/**
 * 살짝 올린 높이. 요약 한 줄, 여행 카드 줄, 갈림길 단추(기간 · 지도/목록)가 들어간다.
 *
 * 예전(212px)에는 달 막대가 이 자리를 차지해 여행 목록이 시트를 끌어올려야 보였다. 카드 줄(약 112px)이 들어가야 해서
 * 그만큼 높였다. 달 막대는 "기간" 단추 뒤로 접혀, 펼치면 시트가 반쯤 올라온다.
 */
export const PEEK = 248;
/**
 * 아직 얹을 것이 없을 때의 살짝 높이. 로그인·사진 고르기 안내가 두 줄에
 * 단추까지 들어가야 한다 — 132px 로는 단추가 잘려 정작 누를 것이 안 보였다.
 */
export const PEEK_EMPTY = 216;

/** 시트 높이(px). 틀 높이에 맞춰 셈한다. */
export function snapHeights(frame: number, peek = PEEK): Record<Snap, number> {
  const full = Math.max(peek + 80, frame - 64);
  const half = Math.min(full, Math.max(peek + 60, Math.round(frame * 0.48)));
  return { peek, half, full };
}

/** 손을 뗀 자리와 빠르기로 멈출 칸을 고른다. 휙 올리면 한 칸 더 간다. */
export function settle(height: number, velocity: number, heights: Record<Snap, number>): Snap {
  // 0.25초쯤 더 미끄러진 자리를 기준으로 삼는다.
  const aimed = height + velocity * 250;
  const order: Snap[] = ["peek", "half", "full"];
  return order.reduce((best, snap) =>
    Math.abs(heights[snap] - aimed) < Math.abs(heights[best] - aimed) ? snap : best,
  );
}

/** 머리를 톡 치면 오갈 칸. */
const TAP_NEXT: Record<Snap, Snap> = { peek: "half", half: "peek", full: "half" };

interface HubSheetProps {
  snap: Snap;
  onSnap: (snap: Snap) => void;
  heights: Record<Snap, number>;
  /** 끄는 동안의 높이를 바깥에 알린다. 지도가 가려진 만큼 범위를 잰다. */
  onHeight?: (height: number) => void;
  header: ReactNode;
  children: ReactNode;
}

export function HubSheet({ snap, onSnap, heights, onHeight, header, children }: HubSheetProps) {
  const [dragging, setDragging] = useState<number | null>(null);
  const start = useRef<{ y: number; height: number; at: number } | null>(null);
  const last = useRef<{ y: number; at: number } | null>(null);

  const height = dragging ?? heights[snap];

  const down = (event: PointerEvent<HTMLDivElement>) => {
    /*
      머리 안의 단추·링크를 누른 것은 끌기가 아니다. 손잡이만은 예외다 —
      사람이 가장 먼저 잡는 곳이 손잡이인데, 거기서 안 끌리면 시트가
      고장 난 것처럼 보인다(실제로 그랬다).
    */
    const target = event.target as HTMLElement;
    // 달 막대처럼 제 손가락 처리를 가진 것도 끌기가 아니다.
    if (!target.closest("[data-handle]") && target.closest("a,button,input,[data-no-drag]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { y: event.clientY, height: heights[snap], at: event.timeStamp };
    last.current = { y: event.clientY, at: event.timeStamp };
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const next = Math.min(
      heights.full,
      Math.max(heights.peek, start.current.height + (start.current.y - event.clientY)),
    );
    last.current = { y: event.clientY, at: event.timeStamp };
    setDragging(next);
    onHeight?.(next);
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    const began = start.current;
    start.current = null;
    if (!began) return;

    const moved = began.y - event.clientY;
    let next: Snap;
    if (Math.abs(moved) < 6) {
      next = TAP_NEXT[snap];
    } else {
      const previous = last.current ?? { y: began.y, at: began.at };
      const dt = Math.max(1, event.timeStamp - previous.at);
      // 위로 올리면 +. 마지막 한 토막의 빠르기만 본다 — 처음 망설인 것은 빼고.
      const velocity = (previous.y - event.clientY) / dt;
      next = settle(began.height + moved, velocity, heights);
    }
    setDragging(null);
    onHeight?.(heights[next]);
    onSnap(next);
  };

  return (
    <section
      aria-label="내 여행 목록"
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-[20px] bg-surface shadow-[0_-6px_24px_rgba(0,0,0,0.14)] ring-1 ring-line"
      style={{
        height,
        transition: dragging === null ? "height 260ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
      }}
    >
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5 active:cursor-grabbing"
      >
        {/*
          손잡이. 끌면 끌리고, 톡 치면 한 칸 오간다(둘 다 위의 손가락
          처리가 맡는다). 자판으로는 Enter·Space 로 오간다.
        */}
        <div
          data-handle
          role="button"
          tabIndex={0}
          aria-label={snap === "peek" ? "목록 펼치기" : "목록 접기"}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSnap(TAP_NEXT[snap]);
          }}
          className="mx-auto mb-2 grid h-6 w-20 place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true" className="block h-1.5 w-10 rounded-full bg-line-strong" />
        </div>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
    </section>
  );
}
