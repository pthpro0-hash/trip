/*
  보던 카드로 돌아간다.

  한참 내려간 뒤 상세로 들어갔다 돌아오면 맨 위였다. 다시 그만큼
  내려가야 한다. 내 여행도, 둘러보기도, 권역별도 마찬가지다.

  자리를 픽셀로 적어 두는 길도 있다. 그 길은 두 번 틀렸다.

  하나, 목록에서 들어간 사람만 자리가 있다. 한장 요약의 점을
  눌러서, 권역 목록에서, 주소를 바로 열어서 — 상세로 오는 길은 여럿인데
  그 사람들에게는 되돌아갈 픽셀이 아예 없다.

  둘, 픽셀은 쉽게 어긋난다. 돌아오는 동안 목록은 한 번 맨 위로 튕기고,
  사진과 권유 띠가 뒤늦게 끼어들며 높이가 바뀐다. 그 틈마다 적어 둔
  숫자가 흐트러진다.

  그래서 숫자가 아니라 카드를 적어 둔다. "1840px" 이 아니라 "이한도예
  외 2곳". 목록이 얼마나 길어지든, 사진이 언제 들어오든, 어느 길로
  들어왔든, 그 카드를 찾아 세우면 된다.

  목록마다 장부를 따로 둔다. 여행 장부와 여행지 장부가 섞이면, 스케치를
  보다 나와서 둘러보기를 열었을 때 엉뚱한 카드 앞에 서게 된다.
*/

/** 저장소가 막혀 있어도(사생활 보호 창 등) 앱이 멈추지 않게 한다. */
function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** 한 목록의 장부. */
export interface FocusMemory {
  /** 목록으로 돌아가면 이 카드 앞에 세워 달라고 적어 둔다. */
  remember(id: string): void;
  /**
   * 세울 카드. 읽기만 하고 지우지는 않는다.
   *
   * 읽으면서 지우면 두 번 물었을 때 두 번째가 빈손이 된다. React 는
   * 개발 중에 시작을 일부러 두 번 하고, 화면이 다시 그려지는 경우도
   * 있다. 지우는 것은 실제로 다 세우고 난 뒤에 따로 한다.
   */
  peek(): string | null;
  /** 다 세웠다. 새로고침할 때마다 같은 카드로 끌려가지 않게 지운다. */
  forget(): void;
  /** 카드를 찾는 이름표. 목록이 다는 것과 여기서 찾는 것이 같아야 한다. */
  cardId(id: string): string;
  /**
   * 어느 목록에서 왔는지 적어 둔다.
   *
   * 여행지 상세는 둘러보기에서도 권역별에서도 열린다. 돌아갈 곳이
   * 둘이라 상세 혼자서는 알 수 없고, 떠나올 때 적어 두는 수밖에 없다.
   */
  rememberFrom(href: string): void;
  /** 돌아갈 목록. 적어 둔 적이 없으면 null — 주소를 바로 연 사람이다. */
  from(): string | null;
}

export function focusMemory(ns: string): FocusMemory {
  const FOCUS = `${ns}:focus`;
  const FROM = `${ns}:from`;

  return {
    remember(id) {
      if (id) session()?.setItem(FOCUS, id);
    },
    peek() {
      return session()?.getItem(FOCUS) || null;
    },
    forget() {
      session()?.removeItem(FOCUS);
    },
    cardId(id) {
      return `${ns}-${id}`;
    },
    rememberFrom(href) {
      if (href) session()?.setItem(FROM, href);
    },
    from() {
      return session()?.getItem(FROM) || null;
    },
  };
}

/** 내 여행의 여행들. */
export const tripFocus = focusMemory("trip");

/** 둘러보기와 권역별의 여행지들. 둘은 같은 카드를 쓰므로 장부도 하나다. */
export const spotFocus = focusMemory("spot");

/** 되짚기를 포기하는 한계. 프레임으로 센다 — 화면이 멈춘 동안은 흐르지 않는다. */
const LIMIT = 180;

/** 자리와 길이가 이만큼 그대로면 다 앉은 것으로 본다. */
const SETTLED = 20;

/** 카드를 화면 위에서 이만큼 내려온 자리에 세운다. 바로 앞 여행도 보이게. */
const FROM_TOP = 0.3;

/**
 * 그 카드 앞에 세운다.
 *
 * 한 번 옮기고 마는 것으로는 안 된다. 그때의 목록은 아직 짧아서 —
 * 이제 막 그려졌고, 사진도 권유 띠도 덜 왔다 — 브라우저가 갈 수 있는
 * 데까지만 데려다 놓는다. 그러고 나서 목록이 길어지면 사람은 이미
 * 엉뚱한 자리에 있다.
 *
 * 그래서 카드가 나타날 때까지 기다렸다가, 자리와 길이가 한동안 그대로일
 * 때까지 되짚는다. 시간이 아니라 프레임으로 센다 — 화면을 옮겨 가는
 * 동안 브라우저는 그림 그리기를 멈추는데(재어 보면 1초 가까이 된다),
 * 초로 세면 그 멈춘 시간이 그대로 깎여 정작 그릴 수 있게 되었을 때는
 * 이미 포기한 뒤다.
 *
 * 사람이 손을 대면 그 즉시 그만둔다. 되짚기가 사람과 힘겨루기를 하면
 * 안 된다.
 *
 * @returns 되짚기를 멈추는 함수.
 */
export function restoreToCard(elementId: string, onDone?: () => void): () => void {
  let frames = 0;
  /** 아무것도 변하지 않은 채 지나간 프레임 수. */
  let still = 0;
  let height = -1;
  let top = Number.NaN;
  let id = 0;
  let stopped = false;

  /*
    그냥 손을 떼는 것과, 할 일을 마치는 것을 가른다.

    화면이 접히면서 손을 떼는 것은 "다 했다"가 아니다. 그때까지 onDone
    을 부르면 적어 둔 여행을 지워 버려, 곧바로 다시 그려질 때 돌아갈
    곳을 잃는다.
  */
  const halt = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(id);
    window.removeEventListener("wheel", finish);
    window.removeEventListener("touchstart", finish);
    window.removeEventListener("keydown", finish);
  };

  function finish() {
    if (stopped) return;
    halt();
    onDone?.();
  }

  const tick = () => {
    if (stopped) return;

    const card = document.getElementById(elementId);
    if (card) {
      const box = card.getBoundingClientRect();
      const grown = document.documentElement.scrollHeight;
      // 카드가 화면 어디쯤 왔는지. 이것과 문서 길이가 함께 굳어야 다 앉은 것이다.
      const now = Math.round(box.top);
      still = grown === height && Math.abs(now - top) <= 1 ? still + 1 : 0;
      height = grown;
      top = now;

      /*
        카드를 화면 위에서 조금 내려온 자리에 세운다. 딱 맨 위에 붙이면
        위 띠에 가려 "여기가 그거였나" 싶고, 바로 앞 여행이 안 보여
        어디쯤인지 가늠이 안 된다.
      */
      if (still < SETTLED) {
        const want = window.scrollY + box.top - window.innerHeight * FROM_TOP;
        window.scrollTo(0, Math.max(0, Math.round(want)));
      }
    }

    if (still >= SETTLED || ++frames >= LIMIT) finish();
    else id = requestAnimationFrame(tick);
  };

  window.addEventListener("wheel", finish, { passive: true });
  window.addEventListener("touchstart", finish, { passive: true });
  window.addEventListener("keydown", finish);
  id = requestAnimationFrame(tick);

  return halt;
}
