import type { Shot } from "./types";

/*
  확인 화면의 여행 카드에 붙일 사진.

  사진을 고른 사람이 결과에서 가장 먼저 하는 일은 "이게 내 어느 여행이지?" 하고 알아보는 것이다.
  제목과 날짜만으로는 멈추는 사람이 많다 — 카드마다 그 여행의 사진 몇 장이 있으면 곧바로 알아본다.
*/

/** 카드 하나에 붙일 사진 수. */
export const PREVIEW_COUNT = 3;

/**
 * 여행의 사진 중 카드에 붙일 것을 시간에 고르게 고른다(처음 · 가운데 · 끝).
 *
 * 앞에서 세 장을 고르면 같은 곳에서 연달아 찍은 같은 장면이 되기 쉽다. 사진은 찍은 순서로 들어와야 한다
 * (여행의 사진은 그렇게 만들어진다). 장수가 모자라면 있는 대로 다 쓴다.
 */
export function pickPreviewShots(shots: Shot[], count = PREVIEW_COUNT): Shot[] {
  if (count <= 0) return [];
  if (shots.length <= count) return [...shots];
  if (count === 1) return [shots[0]];
  const last = shots.length - 1;
  // 간격이 1보다 커서 반올림해도 같은 자리에 겹치지 않는다.
  return Array.from({ length: count }, (_, i) => shots[Math.round((i * last) / (count - 1))]);
}

const nothing = () => undefined;

/** 앞선 일이 모두 끝난 자리. 실패는 이 줄을 막지 않으므로 늘 이행된다. */
let tail: Promise<void> = Promise.resolve();

/** 사진 한 장을 펼치는 데 이보다 오래 걸리면 멈춘 것으로 본다. */
const TOO_LONG_MS = 15_000;

/** 일이 제때 끝나지 않으면 실패로 돌려준다. 끝났으면 시계를 거둔다. */
function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("too long")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * 일을 한 번에 하나씩, 들어온 차례대로 한다.
 *
 * 사진 하나를 펼치는 일은 메모리를 많이 쓴다(12MP 사진이 펼쳐지면 50MB 가까이). 카드 열 장이 동시에
 * 세 장씩 펼치면 폰이 버틴다고 장담할 수 없다. 하나가 실패해도 — 브라우저가 못 여는 형식이 그렇다 —
 * 뒤의 일은 계속한다. 하나가 끝나지 않고 멈춰 있어도 정해진 시간이 지나면 실패로 치고 넘어간다 —
 * 한 장이 모든 카드의 그림을 세워서는 안 된다.
 */
export function inSequence<T>(job: () => Promise<T>, limitMs = TOO_LONG_MS): Promise<T> {
  const run = tail.then(() => withinTime(job(), limitMs));
  tail = run.then(nothing, nothing);
  return run;
}
