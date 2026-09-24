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

/** 되짚기를 포기하는 한계. 프레임으로 센다 — 화면이 멈춰 있는 동안은 흐르지 않는다. */
const LIMIT = 180;

/** 자리와 길이가 이만큼 그대로면 다 앉은 것으로 본다. */
const SETTLED = 30;

/**
 * 그 자리로 옮긴다. 한 번으로 끝내지 않고 자리가 앉을 때까지 되짚는다.
 *
 * 한 번만 옮기면 대개 실패한다. 그때의 문서는 아직 짧아서 — 사진이
 * 덜 왔거나 이제 막 그려졌거나 — 브라우저가 갈 수 있는 데까지만
 * 데려다 놓고 만다. 문서가 길어지고 나면 사람은 이미 맨 위에 있다.
 *
 * 시간이 아니라 프레임으로 센다. 화면을 옮겨 가는 동안 브라우저는 그림
 * 그리기를 멈추는데, 초로 세면 그 멈춘 시간이 그대로 깎여 정작 그릴 수
 * 있게 되었을 때는 이미 포기한 뒤다.
 *
 * 자리와 길이가 한동안 그대로면 그만둔다. 늦게 끼어드는 것이 — 사진,
 * 권유 띠 — 다 들어왔다는 뜻이다. 사람이 손을 대면 그 즉시 그만둔다.
 *
 * @param onStop 되짚기가 끝났을 때. 끝나고 나서야 자리를 다시 적을 수 있다.
 * @returns 되짚기를 멈추는 함수.
 */
export function restoreScroll(y: number, onStop?: () => void): () => void {
  let frames = 0;
  /** 아무것도 변하지 않은 채 지나간 프레임 수. */
  let still = 0;
  let height = -1;
  let id = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(id);
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
    onStop?.();
  };

  const tick = () => {
    if (stopped) return;

    const grown = document.documentElement.scrollHeight;
    // 1px 차이로 다시 옮기면 사람이 살짝 굴린 것까지 되돌린다.
    const there = Math.abs(window.scrollY - y) <= 2;
    still = there && grown === height ? still + 1 : 0;
    height = grown;
    if (!there) window.scrollTo(0, y);

    if (still >= SETTLED || ++frames >= LIMIT) stop();
    else id = requestAnimationFrame(tick);
  };

  window.addEventListener("wheel", stop, { passive: true });
  window.addEventListener("touchstart", stop, { passive: true });
  window.addEventListener("keydown", stop);
  id = requestAnimationFrame(tick);

  return stop;
}
