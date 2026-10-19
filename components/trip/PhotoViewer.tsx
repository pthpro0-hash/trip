"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/*
  사진 한 장을 화면 가득. 좌우 화살표로도, 옆으로 밀어서도 넘긴다.

  더 큰 판을 따로 만들지 않는다. 보관해 둔 것이 이미 긴 변 2048px 이라
  웬만한 화면을 채우고도 남는다. 목록에서는 480px 짜리 작은 판을 쓰지만
  여기서는 보관본을 그대로 불러온다.

  잘라내지 않는다(object-contain). 세로 사진이 가로 화면에서 위아래가
  잘리면 정작 찍은 것이 사라진다.

  넘기는 느낌은 손가락을 따라가야 한다. 이전 · 지금 · 다음 석 장을 나란히 늘어놓고, 밀면 그 줄이 손가락을 따라 움직인다.
  놓았을 때 어느 정도 밀렸거나 빠르게 튕겼으면 옆 장으로 넘어가고, 아니면 제자리로 돌아온다. 화살표(단추 · 키보드)도 같은
  움직임으로 넘어가서 어느 쪽으로 넘겼는지 눈에 보인다.

  빨리 넘기려고 두 가지를 한다.
    1. 옆 장은 이미 그려져 있다 — 넘기는 순간 새로 불러오는 것이 아니라 이미 받아 둔 그림이 들어온다.
    2. 앞뒤 몇 장은 그림을 미리 받아 브라우저에 담아 둔다(PRELOAD). 주소는 부르는 쪽이 미리 받아 둔다(lib/useBigPhotos).
  큰 판이 오기 전에는 작은 판(있으면)을 먼저 보이고, 큰 판이 다 오면 부드럽게 바꾼다.
*/

interface PhotoViewerProps {
  total: number;
  /** 지금 보는 사진의 번호. 0부터. */
  current: number;
  /** 번호로 큰 판의 주소를 찾는다. 아직 받지 못했으면 null. */
  urlAt: (index: number) => string | null;
  /** 큰 판이 오기 전에 먼저 보일 작은 판. 없으면 null. */
  previewAt?: (index: number) => string | null;
  /** 다른 사진으로 넘어갔다(끝에서 넘기면 처음으로 돈다). */
  onChange: (index: number) => void;
  onClose: () => void;
}

/** 놓았을 때 화면 폭의 이만큼 넘게 밀렸으면 넘긴다. */
const SWIPE_RATIO = 0.18;
/** 이만큼 빠르게 튕겼으면(px/ms) 조금만 밀렸어도 넘긴다. */
const SWIPE_SPEED = 0.45;
/** 이 이상 움직여야 누른 것이 아니라 민 것으로 본다(px). 밀고 난 뒤의 클릭이 바깥 누름으로 닫히지 않게. */
const DRAG_SLOP = 6;
/** 넘어가는 움직임의 길이. */
const SETTLE_MS = 200;
/** 앞뒤로 그림을 미리 받아 둘 장 수. */
const PRELOAD = 2;

const wrap = (index: number, total: number) => ((index % total) + total) % total;

/** 한 장. 작은 판이 먼저 보이고 큰 판이 다 오면 그 위로 부드럽게 바뀐다. */
function Slide({ url, preview, current }: { url: string | null; preview: string | null; current: boolean }) {
  const [loaded, setLoaded] = useState(false);
  // 주소가 바뀌면(다른 사진이 들어오면) 다 왔다는 표시를 지운다 — 새 사진의 큰 판은 아직이다.
  const [seen, setSeen] = useState(url);
  if (seen !== url) {
    setSeen(url);
    setLoaded(false);
  }

  return (
    <div className="relative flex h-full w-full shrink-0 items-center justify-center p-4" data-slide={current ? "current" : "near"}>
      {preview && !loaded && (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
        <img
          src={preview}
          alt=""
          draggable={false}
          data-photo="preview"
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full select-none object-contain"
        />
      )}
      {url ? (
        // 보관함의 서명 주소라 그때그때 달라진다. next/image 로 미리 최적화할 수 없다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          draggable={false}
          data-photo="big"
          onLoad={() => setLoaded(true)}
          // 사진 자체를 누른 것은 닫지 않는다(바깥을 눌러야 닫힌다).
          onClick={(event) => event.stopPropagation()}
          // 작은 판이 있으면 그 위에 겹쳐 놓고 다 오면 보인다. 없으면 오는 대로 보인다.
          className={`select-none object-contain transition-opacity duration-150 ${
            preview ? "absolute inset-0 m-auto max-h-[calc(100%-2rem)] max-w-[calc(100%-2rem)]" : "max-h-full max-w-full"
          } ${preview && !loaded ? "opacity-0" : "opacity-100"}`}
        />
      ) : (
        !preview && <p className="text-[15px] text-white/70">불러오는 중…</p>
      )}
    </div>
  );
}

export function PhotoViewer({ total, current, urlAt, previewAt, onChange, onClose }: PhotoViewerProps) {
  const prev = wrap(current - 1, total);
  const next = wrap(current + 1, total);

  // 손가락이 따라 움직인 거리(px)와, 놓은 뒤 넘어가는 중인 방향(-1 이전 · 1 다음).
  const [dragX, setDragX] = useState(0);
  const [settling, setSettling] = useState<-1 | 0 | 1>(0);
  const [dragging, setDragging] = useState(false);
  // 새 사진으로 바뀌며 줄이 가운데로 돌아올 때는 움직임 없이 곧바로 — 한 장 되감기는 것처럼 보이지 않게.
  const [instant, setInstant] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 최신 값을 키보드·타이머가 읽는다.
  const latest = useRef({ current, total, settling });
  useEffect(() => {
    latest.current = { current, total, settling };
  });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // 곧바로 돌아온 다음 그릴 틈에 움직임을 다시 켠다.
  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  /** 옆 장으로 넘어간다 — 그 방향으로 줄이 끝까지 밀려 가고 나서 새 사진으로 바뀐다. */
  const go = (step: -1 | 1) => {
    const now = latest.current;
    if (now.total < 2 || now.settling !== 0) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const finish = () => {
      timer.current = null;
      // 줄이 새 사진 가운데로 돌아오는 것과 사진이 바뀌는 것을 한 번에 — 번쩍이지 않게.
      setInstant(true);
      setSettling(0);
      setDragX(0);
      onChange(wrap(latest.current.current + step, latest.current.total));
    };
    if (reduce) {
      finish();
      return;
    }
    setSettling(step);
    timer.current = setTimeout(finish, SETTLE_MS);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);

    // 뒤에 깔린 목록이 같이 굴러다니면 어지럽다.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
    // go 는 늘 최신 값을 ref 로 읽으므로 다시 달 까닭이 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onChange]);

  // 앞뒤 몇 장의 그림을 미리 받아 둔다 — 넘기는 순간에는 이미 브라우저에 있다.
  useEffect(() => {
    for (let step = 1; step <= PRELOAD; step += 1) {
      for (const index of total > 1 ? [wrap(current + step, total), wrap(current - step, total)] : []) {
        const url = urlAt(index);
        if (url) new Image().src = url;
      }
    }
  }, [current, total, urlAt]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (total < 2 || settling !== 0 || (event.pointerType === "mouse" && event.button !== 0)) return;
    start.current = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId };
    moved.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    if (!from || from.id !== event.pointerId) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!moved.current) {
      // 세로로 더 움직이면 미는 것이 아니다(스크롤·시스템 제스처에 양보).
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > DRAG_SLOP) {
        start.current = null;
        return;
      }
      if (Math.abs(dx) < DRAG_SLOP) return;
      moved.current = true;
      setDragging(true);
      box.current?.setPointerCapture?.(event.pointerId);
    }
    setDragX(dx);
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    if (!from || !moved.current) return;
    setDragging(false);
    const width = box.current?.clientWidth || window.innerWidth;
    const dx = event.clientX - from.x;
    const speed = Math.abs(dx) / Math.max(1, event.timeStamp - from.t);
    const enough = Math.abs(dx) > width * SWIPE_RATIO || (speed > SWIPE_SPEED && Math.abs(dx) > DRAG_SLOP * 3);
    if (event.type !== "pointercancel" && enough) {
      // 밀린 쪽 반대로 넘어간다: 오른쪽으로 밀면 이전 사진, 왼쪽으로 밀면 다음 사진.
      go(dx > 0 ? -1 : 1);
    } else {
      setDragX(0);
    }
  };

  // 줄의 위치: 가운데(지금) 장이 보이도록 -100%, 손가락 거리만큼 더하고, 넘어가는 중이면 한 장 만큼 더 민다.
  const slide = settling === 0 ? 0 : settling === 1 ? -1 : 1;
  const offset = settling === 0 ? dragX : 0;
  const base = total > 1 ? -100 : 0;
  const transform = `translate3d(calc(${base + slide * 100}% + ${offset}px), 0, 0)`;
  const animated = !instant && !dragging && (settling !== 0 || dragX === 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`사진 ${current + 1}/${total} 크게 보기`}
      // 바깥을 누르면 닫힌다. 사진 자체를 누른 것은 아래에서 막고, 민 뒤의 클릭은 닫지 않는다.
      onClick={() => {
        if (moved.current) {
          moved.current = false;
          return;
        }
        onClose();
      }}
      className="fixed inset-0 z-50 overflow-hidden bg-black/92"
    >
      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        // 옆으로 미는 것은 우리가 받고, 위아래로 미는 것은 브라우저에 맡긴다.
        style={{ touchAction: "pan-y" }}
        className="absolute inset-0 overflow-hidden"
      >
        <div
          data-track=""
          style={{
            transform,
            transition: animated ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : "none",
            willChange: "transform",
          }}
          className="flex h-full w-full"
        >
          {/* 이전 · 지금 · 다음. 한 장뿐이면 지금만. */}
          {/* 사진 번호를 열쇠로 둬서, 넘어갈 때 옆 장이 그대로 가운데로 옮겨 온다(다시 그리며 깜빡이지 않는다). 둘뿐이면 이전과 다음이 같은 사진이라 자리 이름으로. */}
          {total > 1 && <Slide key={total === 2 ? "prev" : prev} url={urlAt(prev)} preview={previewAt?.(prev) ?? null} current={false} />}
          <Slide key={current} url={urlAt(current)} preview={previewAt?.(current) ?? null} current />
          {total > 1 && <Slide key={total === 2 ? "next" : next} url={urlAt(next)} preview={previewAt?.(next) ?? null} current={false} />}
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
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
              go(-1);
            }}
            aria-label="이전 사진"
            className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-[22px] text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              go(1);
            }}
            aria-label="다음 사진"
            className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-[22px] text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            ›
          </button>
          <p className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-[14px] font-medium text-white/80">
            {current + 1} / {total}
          </p>
        </>
      )}
    </div>
  );
}
