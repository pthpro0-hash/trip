/*
  목록의 자리를 기억한다.

  스물다섯 번째 여행을 보려고 한참 내려간 뒤 상세로 들어갔다 돌아오면
  맨 위였다. 다시 스물다섯 번을 내려가야 한다.

  브라우저의 뒤로가기는 자리를 되살려 주지만, 상세의 "← 내 스케치"는
  뒤로가기가 아니라 새 이동이라 맨 위로 간다. 그래서 따로 기억해 둔다.

  세션 저장소를 쓴다. 탭을 닫으면 사라지는 게 맞다 — 어제 보던 자리로
  돌아갈 이유는 없다.
*/

const WHERE = "trips:scroll";
const ASKED = "trips:restore";

/** 저장소가 막혀 있어도(사생활 보호 창 등) 앱이 멈추지 않게 한다. */
function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 지금 자리를 적어 둔다. */
export function rememberScroll(y: number): void {
  session()?.setItem(WHERE, String(Math.max(0, Math.round(y))));
}

/**
 * 돌아가면 그 자리로 데려가 달라고 표시한다.
 *
 * 표시가 있을 때만 되살린다. 위 띠의 "내 스케치"를 눌러 온 사람은
 * 목록을 처음부터 보려는 것이지, 아까 그 자리로 가려는 게 아니다.
 */
export function askRestore(): void {
  session()?.setItem(ASKED, "1");
}

/**
 * 되살릴 자리. 한 번 꺼내면 표시는 지워진다 — 새로고침할 때마다
 * 같은 자리로 끌려가지 않게.
 */
export function takeScroll(): number | null {
  const store = session();
  if (!store) return null;
  if (store.getItem(ASKED) !== "1") return null;

  store.removeItem(ASKED);
  const saved = Number(store.getItem(WHERE));
  return Number.isFinite(saved) && saved > 0 ? saved : null;
}
