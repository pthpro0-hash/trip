"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type WheelEvent as ReactWheelEvent } from "react";

/*
  사진 한 장을 화면 가득. 좌우 화살표로도, 옆으로 밀어서도 넘기고, 두 손가락으로 · 두 번 눌러서 확대한다.

  더 큰 판을 따로 만들지 않는다. 보관해 둔 것이 이미 긴 변 2048px 이라
  웬만한 화면을 채우고도 남는다. 목록에서는 480px 짜리 작은 판을 쓰지만
  여기서는 보관본을 그대로 불러온다.

  잘라내지 않는다(object-contain). 세로 사진이 가로 화면에서 위아래가
  잘리면 정작 찍은 것이 사라진다.

  넘기는 느낌은 손가락을 따라가야 한다. 이전 · 지금 · 다음 석 장을 나란히 늘어놓고, 밀면 그 줄이 손가락을 따라 움직인다.
  놓았을 때 어느 정도 밀렸거나 빠르게 튕겼으면 옆 장으로 넘어가고, 아니면 제자리로 돌아온다. 화살표(단추 · 키보드)도 같은
  움직임으로 넘어가서 어느 쪽으로 넘겼는지 눈에 보인다.

  확대는 이 안에서 직접 한다. 사진 영역이 손가락 움직임을 모두 받으므로(touch-action: none) 브라우저의 확대에 기대지 않는다 —
  옆으로 미는 것을 받으려고 이 영역의 터치 동작을 막았더니 두 손가락 확대와 두 번 누르기 확대가 함께 막혀 버린 적이 있다.
    · 두 손가락을 벌리고 오므리면 확대 · 축소(손가락 가운데가 제자리에 머문다)
    · 두 번 누르면 그 자리를 키우고, 한 번 더 누르면 원래대로
    · 확대한 동안에는 한 손가락으로 사진을 끌어 옮긴다(가장자리 밖으로는 못 간다). 이때는 옆 장으로 넘기지 않는다
    · 컴퓨터에서는 휠 · 확대 단추 · + − 0 키
  다른 사진으로 넘어가면 확대는 풀린다.

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
/** 가장 크게 확대하는 배율. */
const MAX_SCALE = 5;
/** 두 번 눌렀을 때와 확대 단추의 배율. */
const TAP_SCALE = 2.5;
/** 두 번 누름으로 치는 간격(ms)과 거리(px). */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 32;
/** 이 배율 안쪽으로 오므리고 놓으면 원래 크기로 붙인다. */
const SNAP_SCALE = 1.08;

const wrap = (index: number, total: number) => ((index % total) + total) % total;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 확대 상태. x · y 는 사진 가운데에서 옮겨 간 거리(px, 확대한 뒤 기준). */
interface Zoom {
  scale: number;
  x: number;
  y: number;
}
const FIT: Zoom = { scale: 1, x: 0, y: 0 };

/** 화면(box)과 사진(image)의 크기로 사진이 화면 밖으로 달아나지 않게 붙든다. 사진이 화면보다 작으면 가운데에 둔다. */
function clampZoom(zoom: Zoom, box: { w: number; h: number }, image: { w: number; h: number }): Zoom {
  const scale = clamp(zoom.scale, 1, MAX_SCALE);
  if (scale <= 1.001) return FIT;
  const mx = Math.max(0, (image.w * scale - box.w) / 2);
  const my = Math.max(0, (image.h * scale - box.h) / 2);
  return { scale, x: clamp(zoom.x, -mx, mx), y: clamp(zoom.y, -my, my) };
}

/** 한 장. 작은 판이 먼저 보이고 큰 판이 다 오면 그 위로 부드럽게 바뀐다. 지금 장만 확대된다. */
function Slide({
  url,
  preview,
  current,
  zoom,
  smooth,
  imageRef,
}: {
  url: string | null;
  preview: string | null;
  current: boolean;
  zoom?: Zoom;
  smooth?: boolean;
  imageRef?: RefObject<HTMLDivElement | null>;
}) {
  const [loaded, setLoaded] = useState(false);
  // 주소가 바뀌면(다른 사진이 들어오면) 다 왔다는 표시를 지운다 — 새 사진의 큰 판은 아직이다.
  const [seen, setSeen] = useState(url);
  if (seen !== url) {
    setSeen(url);
    setLoaded(false);
  }

  const zoomed = zoom && zoom.scale > 1;
  return (
    // 확대한 사진이 옆 장으로 번지지 않게 이 칸 안에서 자른다.
    <div className="relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden p-4" data-slide={current ? "current" : "near"}>
      <div
        ref={current ? imageRef : undefined}
        data-zoom={current ? (zoom?.scale ?? 1) : undefined}
        style={
          zoom
            ? {
                transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`,
                transition: smooth ? "transform 180ms ease-out" : "none",
                willChange: zoomed ? "transform" : undefined,
              }
            : undefined
        }
        className="relative flex max-h-full max-w-full items-center justify-center"
      >
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
            // 작은 판이 있으면 큰 판이 다 올 때까지 그 위에 투명하게 겹쳐 두었다가, 다 오면 작은 판을 거두고 자리를 잡는다.
            // (자리를 잡은 뒤에야 이 칸의 크기가 큰 판으로 정해진다 — 확대가 이 크기를 쓴다.)
            className={`select-none object-contain ${
              preview && !loaded ? "absolute inset-0 m-auto max-h-full max-w-full opacity-0" : "max-h-full max-w-full"
            }`}
          />
        ) : (
          !preview && <p className="text-[15px] text-white/70">불러오는 중…</p>
        )}
      </div>
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
  /*
    확대 상태. 어느 사진의 것인지(at)를 함께 적어 둬서, 다른 사진으로 넘어가면 저절로 풀린다(되돌리는 일을 따로 하지 않는다).
    smooth: 두 번 누름 · 단추처럼 한 번에 바뀔 때만 부드럽게. 손가락을 따라갈 때는 움직임을 주지 않는다.
  */
  const [zoomState, setZoomState] = useState<{ at: number; zoom: Zoom; smooth: boolean }>({ at: current, zoom: FIT, smooth: false });
  const zoom = zoomState.at === current ? zoomState.zoom : FIT;
  const zoomedIn = zoom.scale > 1;

  const box = useRef<HTMLDivElement>(null);
  const imageBox = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const moved = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 닿아 있는 손가락들과, 두 손가락 · 한 손가락 끌기 · 두 번 누름의 기억.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; s0: number; qx: number; qy: number } | null>(null);
  const pan = useRef<{ x: number; y: number; zx: number; zy: number } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  // 최신 값을 키보드·타이머가 읽는다.
  const latest = useRef({ current, total, settling, zoom });
  useEffect(() => {
    latest.current = { current, total, settling, zoom };
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

  /** 화면과 사진(확대 전)의 크기. 사진이 화면 밖으로 달아나지 않게 붙드는 데 쓴다. */
  const sizes = () => {
    const area = box.current;
    const image = imageBox.current;
    return {
      box: { w: area?.clientWidth ?? 0, h: area?.clientHeight ?? 0 },
      image: { w: image?.offsetWidth ?? 0, h: image?.offsetHeight ?? 0 },
    };
  };
  /** 화면 가운데(확대의 기준점). */
  const center = () => {
    const rect = box.current?.getBoundingClientRect();
    return { x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2 };
  };

  const setZoom = (next: Zoom, smooth = false) => {
    const { box: area, image } = sizes();
    setZoomState({ at: latest.current.current, zoom: clampZoom(next, area, image), smooth });
  };

  /** (px, py) 화면 좌표를 제자리에 둔 채 배율을 바꾼다. */
  const zoomAround = (scale: number, px: number, py: number, smooth: boolean) => {
    const from = latest.current.zoom;
    const c = center();
    const vx = px - c.x;
    const vy = py - c.y;
    // 손가락 아래의 사진 위 점(확대 전 좌표)은 그대로, 배율만 바뀐다.
    const qx = (vx - from.x) / from.scale;
    const qy = (vy - from.y) / from.scale;
    setZoom({ scale, x: vx - qx * scale, y: vy - qy * scale }, smooth);
  };

  /** 확대 단추 · 두 번 누름 — 원래 크기면 키우고, 키워 있으면 원래대로. */
  const toggleZoom = (px?: number, py?: number) => {
    if (latest.current.zoom.scale > 1) {
      setZoom(FIT, true);
      return;
    }
    const c = center();
    zoomAround(TAP_SCALE, px ?? c.x, py ?? c.y, true);
  };

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
      // 컴퓨터에서 확대: + 키우기, − 줄이기, 0 원래대로.
      if (event.key === "+" || event.key === "=") {
        const c = center();
        zoomAround(Math.min(MAX_SCALE, latest.current.zoom.scale * 1.5), c.x, c.y, true);
      }
      if (event.key === "-" || event.key === "_") {
        const c = center();
        zoomAround(latest.current.zoom.scale / 1.5, c.x, c.y, true);
      }
      if (event.key === "0") setZoom(FIT, true);
    };
    window.addEventListener("keydown", onKey);

    // 뒤에 깔린 목록이 같이 굴러다니면 어지럽다.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
    // go · zoomAround 는 늘 최신 값을 ref 로 읽으므로 다시 달 까닭이 없다.
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

  /** 두 번 누름인가 — 짧은 사이에 가까운 자리를 다시 눌렀다. 맞으면 확대를 바꾸고 true. */
  const doubleTapped = (event: ReactPointerEvent<HTMLDivElement>) => {
    const before = lastTap.current;
    const near = before && event.timeStamp - before.t < DOUBLE_TAP_MS && Math.hypot(event.clientX - before.x, event.clientY - before.y) < DOUBLE_TAP_PX;
    if (near) {
      lastTap.current = null;
      toggleZoom(event.clientX, event.clientY);
      return true;
    }
    lastTap.current = { t: event.timeStamp, x: event.clientX, y: event.clientY };
    return false;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      // 두 손가락 — 확대. 하던 밀기 · 끌기는 접는다.
      start.current = null;
      pan.current = null;
      moved.current = true;
      setDragging(false);
      setDragX(0);
      const [a, b] = [...pointers.current.values()];
      const c = center();
      const from = latest.current.zoom;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch.current = {
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        s0: from.scale,
        // 가운데 손가락 아래의 사진 위 점. 배율이 바뀌어도 이 점이 손가락 아래에 머문다.
        qx: (mid.x - c.x - from.x) / from.scale,
        qy: (mid.y - c.y - from.y) / from.scale,
      };
      box.current?.setPointerCapture?.(event.pointerId);
      return;
    }
    if (pointers.current.size > 2) return;

    moved.current = false;
    if (zoomedIn) {
      // 확대한 동안 한 손가락은 사진을 끌어 옮긴다. 옆 장으로 넘기지 않는다.
      pan.current = { x: event.clientX, y: event.clientY, zx: zoom.x, zy: zoom.y };
      return;
    }
    if (settling !== 0) return;
    // 한 장뿐이어도 두 번 누르기(확대)를 알아보려고 기억해 둔다. 밀기는 두 장 이상일 때만 한다.
    start.current = { x: event.clientX, y: event.clientY, t: event.timeStamp, id: event.pointerId };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // 두 손가락: 벌린 만큼 확대, 가운데가 움직인 만큼 사진도 따라 움직인다.
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const scale = clamp((pinch.current.s0 * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / pinch.current.d0, 0.6, MAX_SCALE);
      const c = center();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // 1 배보다 작게 오므리는 동안은 줄어드는 모습 그대로 보이고(붙이기는 놓은 뒤), 확대 쪽만 화면 밖으로 달아나지 않게 붙든다.
      const next: Zoom = { scale, x: mid.x - c.x - pinch.current.qx * scale, y: mid.y - c.y - pinch.current.qy * scale };
      if (scale < 1) setZoomState({ at: latest.current.current, zoom: { scale, x: 0, y: 0 }, smooth: false });
      else setZoom(next);
      return;
    }

    // 확대한 한 손가락: 사진을 끌어 옮긴다.
    if (pan.current) {
      const dx = event.clientX - pan.current.x;
      const dy = event.clientY - pan.current.y;
      if (Math.hypot(dx, dy) > DRAG_SLOP) moved.current = true;
      setZoom({ scale: latest.current.zoom.scale, x: pan.current.zx + dx, y: pan.current.zy + dy });
      return;
    }

    const from = start.current;
    if (!from || from.id !== event.pointerId || total < 2) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!moved.current) {
      // 세로로 더 움직이면 미는 것이 아니다.
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
    pointers.current.delete(event.pointerId);

    if (pinch.current) {
      // 손가락 하나가 떨어지면 확대를 마친 것이다. 남은 손가락은 이어서 끌지 않는다(튀지 않게).
      if (pointers.current.size < 2) {
        pinch.current = null;
        pan.current = null;
        start.current = null;
        // 거의 1 배로 오므렸으면 원래 크기로 붙인다.
        if (latest.current.zoom.scale < SNAP_SCALE) setZoom(FIT, true);
      }
      return;
    }

    if (pan.current) {
      const wasTap = !moved.current;
      pan.current = null;
      if (wasTap && event.type === "pointerup") doubleTapped(event);
      return;
    }

    const from = start.current;
    start.current = null;
    if (!from) return;
    if (!moved.current) {
      // 움직이지 않은 짧은 누름 — 두 번째면 확대.
      if (event.type === "pointerup") doubleTapped(event);
      return;
    }
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

  // 컴퓨터 휠 · 트랙패드 모으기: 커서 아래를 중심으로 확대·축소.
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025));
    zoomAround(clamp(latest.current.zoom.scale * factor, 1, MAX_SCALE), event.clientX, event.clientY, false);
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
        onWheel={onWheel}
        // 손가락 움직임은 모두 우리가 받는다 — 옆으로 밀기 · 두 손가락 확대 · 두 번 누르기. 브라우저에 맡기면 확대가 막히거나 화면이 같이 움직인다.
        style={{ touchAction: "none" }}
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
          {/* 사진 번호를 열쇠로 둬서, 넘어갈 때 옆 장이 그대로 가운데로 옮겨 온다(다시 그리며 깜빡이지 않는다). 둘뿐이면 이전과 다음이 같은 사진이라 자리 이름으로. */}
          {total > 1 && <Slide key={total === 2 ? "prev" : prev} url={urlAt(prev)} preview={previewAt?.(prev) ?? null} current={false} />}
          <Slide
            key={current}
            url={urlAt(current)}
            preview={previewAt?.(current) ?? null}
            current
            zoom={zoom}
            smooth={zoomState.smooth}
            imageRef={imageBox}
          />
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

      {total > 1 && !zoomedIn && (
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
        </>
      )}

      {total > 1 && (
        <p className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-[14px] font-medium text-white/80">
          {current + 1} / {total}
        </p>
      )}

      {/* 컴퓨터에서 마우스로도 확대할 수 있게. 폰에서는 두 손가락 · 두 번 누르기로 한다. */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleZoom();
        }}
        aria-label={zoomedIn ? "원래 크기로" : "확대"}
        className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-[18px] text-white backdrop-blur-sm transition hover:bg-white/30"
      >
        <span aria-hidden="true">{zoomedIn ? "−" : "＋"}</span>
      </button>
    </div>
  );
}
