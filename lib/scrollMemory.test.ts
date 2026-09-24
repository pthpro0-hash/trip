import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { askRestore, rememberScroll, restoreScroll, takeScroll } from "./scrollMemory";

/*
  스물다섯 번째 여행을 보려고 한참 내려갔다 상세로 들어갔다 돌아오면
  맨 위였다. 그 자리로 데려가되, 아무 때나 끌고 가지는 않는다.
*/
describe("scrollMemory", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("돌아가 달라고 했을 때만 자리를 되살린다", () => {
    rememberScroll(1200);
    // 위 띠의 "내 스케치"를 눌러 온 사람은 처음부터 보려는 것이다.
    expect(takeScroll()).toBeNull();

    rememberScroll(1200);
    askRestore();
    expect(takeScroll()).toBe(1200);
  });

  it("한 번 꺼내면 표시가 지워진다 — 새로고침마다 끌려가지 않게", () => {
    rememberScroll(800);
    askRestore();
    expect(takeScroll()).toBe(800);
    expect(takeScroll()).toBeNull();
  });

  it("맨 위였으면 되살릴 것이 없다", () => {
    rememberScroll(0);
    askRestore();
    expect(takeScroll()).toBeNull();
  });

  it("적어 둔 적이 없으면 null", () => {
    askRestore();
    expect(takeScroll()).toBeNull();
  });

  it("소수점과 음수를 정리해 둔다", () => {
    rememberScroll(640.7);
    askRestore();
    expect(takeScroll()).toBe(641);

    rememberScroll(-5);
    askRestore();
    expect(takeScroll()).toBeNull();
  });

  it("저장소가 막혀 있어도 던지지 않는다", () => {
    const blocked = () => {
      throw new Error("막힘");
    };
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", { get: blocked, configurable: true });

    expect(() => rememberScroll(100)).not.toThrow();
    expect(() => askRestore()).not.toThrow();
    expect(takeScroll()).toBeNull();

    if (original) Object.defineProperty(window, "sessionStorage", original);
  });
});

/*
  되짚기.

  한 번만 옮기면 거의 늘 실패한다. 그때의 목록은 아직 짧아서 — 사진
  주소가 덜 왔다 — 브라우저가 갈 수 있는 데까지만 데려다 놓는다.
  사진이 들어와 목록이 길어지고 나면 사람은 이미 맨 위에 있다.
*/
describe("restoreScroll", () => {
  let y = 0;
  /** 문서가 짧으면 여기까지밖에 못 내려간다. 브라우저가 하는 그대로. */
  let 끝 = 0;
  let 대기: FrameRequestCallback[] = [];
  const 원래 = {
    scrollY: Object.getOwnPropertyDescriptor(window, "scrollY"),
    scrollTo: window.scrollTo,
    raf: window.requestAnimationFrame,
    caf: window.cancelAnimationFrame,
  };

  /** 프레임을 손으로 돌린다. */
  const 프레임 = (번 = 1) => {
    for (let i = 0; i < 번; i += 1) 대기.shift()?.(0);
  };

  beforeEach(() => {
    y = 0;
    끝 = 0;
    대기 = [];
    Object.defineProperty(window, "scrollY", { get: () => y, configurable: true });
    window.scrollTo = ((_x: number, to: number) => {
      y = Math.max(0, Math.min(to, 끝));
    }) as typeof window.scrollTo;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      대기.push(cb)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;
  });

  afterEach(() => {
    if (원래.scrollY) Object.defineProperty(window, "scrollY", 원래.scrollY);
    window.scrollTo = 원래.scrollTo;
    window.requestAnimationFrame = 원래.raf;
    window.cancelAnimationFrame = 원래.caf;
  });

  it("목록이 길어질 때까지 되짚는다", () => {
    // 사진이 아직 안 왔다. 갈 수 있는 데까지만 간다.
    끝 = 300;
    restoreScroll(1200);
    프레임();
    expect(y).toBe(300);

    // 사진이 들어와 목록이 길어졌다. 이제야 제자리에 닿는다.
    끝 = 4000;
    프레임();
    expect(y).toBe(1200);
  });

  it("사람이 손을 대면 그만둔다", () => {
    끝 = 4000;
    restoreScroll(1200);
    프레임();
    expect(y).toBe(1200);

    // 사람이 위로 굴렸다. 되짚기가 힘겨루기를 하면 안 된다.
    window.dispatchEvent(new Event("wheel"));
    y = 400;
    프레임(5);
    expect(y).toBe(400);
  });

  it("그만두라면 그만둔다", () => {
    끝 = 4000;
    const 그만 = restoreScroll(1200);
    그만();
    y = 0;
    프레임(5);
    expect(y).toBe(0);
  });

  it("자리가 앉으면 일찍 그만둔다", () => {
    끝 = 4000;
    let 끝났나 = false;
    restoreScroll(1200, () => {
      끝났나 = true;
    });
    프레임(40);

    expect(y).toBe(1200);
    // 다 앉았으니 더 붙잡고 있지 않는다. 그래야 다시 자리를 적기 시작한다.
    expect(대기).toHaveLength(0);
    expect(끝났나).toBe(true);
  });

  it("끝내 닿지 못해도 언젠가 멈춘다", () => {
    // 목록이 영영 짧으면 — 기록을 지운 뒤 같은 때 — 붙잡고 있지 않는다.
    끝 = 50;
    restoreScroll(1200);
    프레임(200);
    expect(대기).toHaveLength(0);
  });
});
