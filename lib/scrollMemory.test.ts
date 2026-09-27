import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { focusMemory, restoreToCard, spotFocus, tripFocus } from "./scrollMemory";

/*
  스물다섯 번째 여행을 보려고 한참 내려갔다 상세로 들어갔다 돌아오면
  맨 위였다. 그 여행 카드 앞에 다시 세운다.
*/
describe("focusMemory", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("적어 둔 카드를 읽되, 읽는다고 지우지는 않는다", () => {
    tripFocus.remember("t8");
    // 두 번 물어도 같은 답이라야 한다. React 는 시작을 두 번 하기도 한다.
    expect(tripFocus.peek()).toBe("t8");
    expect(tripFocus.peek()).toBe("t8");

    tripFocus.forget();
    expect(tripFocus.peek()).toBeNull();
  });

  /*
    스케치를 보다 나와서 둘러보기를 열었을 때 엉뚱한 카드 앞에 서면
    안 된다. 목록마다 장부가 따로다.
  */
  it("목록끼리 서로의 장부를 건드리지 않는다", () => {
    tripFocus.remember("t8");
    spotFocus.remember("경복궁");

    expect(tripFocus.peek()).toBe("t8");
    expect(spotFocus.peek()).toBe("경복궁");

    tripFocus.forget();
    expect(spotFocus.peek()).toBe("경복궁");
  });

  it("이름표도 목록마다 다르다", () => {
    expect(tripFocus.cardId("x")).toBe("trip-x");
    expect(spotFocus.cardId("x")).toBe("spot-x");
  });

  /*
    여행지 상세는 둘러보기에서도 권역별에서도 열린다. 돌아갈 곳이 둘이라
    상세 혼자서는 알 수 없고, 떠나올 때 적어 두는 수밖에 없다.
  */
  it("어느 목록에서 왔는지 따로 적어 둔다", () => {
    expect(spotFocus.from()).toBeNull();

    spotFocus.rememberFrom("/regions/%EA%B0%95%EC%9B%90%EA%B6%8C");
    expect(spotFocus.from()).toBe("/regions/%EA%B0%95%EC%9B%90%EA%B6%8C");
    // 어디서 왔는지는 카드를 세운 뒤에도 남는다 — 다음에 또 들어갈 곳이다.
    spotFocus.forget();
    expect(spotFocus.from()).toBe("/regions/%EA%B0%95%EC%9B%90%EA%B6%8C");
  });

  it("적어 둔 적이 없으면 null", () => {
    expect(focusMemory("없는것").peek()).toBeNull();
  });

  it("빈 이름은 적지 않는다", () => {
    tripFocus.remember("");
    expect(tripFocus.peek()).toBeNull();
  });

  it("저장소가 막혀 있어도 던지지 않는다", () => {
    const blocked = () => {
      throw new Error("막힘");
    };
    const original = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", { get: blocked, configurable: true });

    expect(() => tripFocus.remember("t1")).not.toThrow();
    expect(() => tripFocus.forget()).not.toThrow();
    expect(() => spotFocus.rememberFrom("/")).not.toThrow();
    expect(tripFocus.peek()).toBeNull();
    expect(spotFocus.from()).toBeNull();

    if (original) Object.defineProperty(window, "sessionStorage", original);
  });
});

/*
  되짚기.

  한 번만 옮기면 거의 늘 실패한다. 그때의 목록은 아직 짧아서 — 카드가
  아예 없거나, 사진과 권유 띠가 덜 왔다 — 브라우저가 갈 수 있는 데까지만
  데려다 놓는다. 목록이 길어지고 나면 사람은 엉뚱한 자리에 있다.
*/
describe("restoreToCard", () => {
  let y = 0;
  /** 문서가 짧으면 여기까지밖에 못 내려간다. 브라우저가 하는 그대로. */
  let 끝 = 0;
  /** 문서 맨 위에서 카드까지의 거리. 목록이 길어지면 이것도 밀린다. */
  let 카드자리: number | null = null;
  let 대기: FrameRequestCallback[] = [];

  const 원래 = {
    scrollY: Object.getOwnPropertyDescriptor(window, "scrollY"),
    innerHeight: Object.getOwnPropertyDescriptor(window, "innerHeight"),
    scrollTo: window.scrollTo,
    raf: window.requestAnimationFrame,
    caf: window.cancelAnimationFrame,
  };

  /** 프레임을 손으로 돌린다. */
  const 프레임 = (번 = 1) => {
    for (let i = 0; i < 번; i += 1) 대기.shift()?.(0);
  };

  /** 목록에 카드를 놓는다. 화면 기준 위치는 문서상 자리에서 스크롤을 뺀 값이다. */
  const 카드놓기 = (문서상: number) => {
    카드자리 = 문서상;
    let el = document.getElementById("card-8");
    if (!el) {
      el = document.createElement("div");
      el.id = "card-8";
      document.body.appendChild(el);
    }
    el.getBoundingClientRect = () => ({ top: 카드자리! - y }) as DOMRect;
  };

  beforeEach(() => {
    y = 0;
    끝 = 0;
    카드자리 = null;
    대기 = [];
    document.body.innerHTML = "";
    Object.defineProperty(window, "scrollY", { get: () => y, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    window.scrollTo = ((_x: number, to: number) => {
      y = Math.max(0, Math.min(to, 끝));
    }) as typeof window.scrollTo;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      대기.push(cb)) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;
  });

  afterEach(() => {
    if (원래.scrollY) Object.defineProperty(window, "scrollY", 원래.scrollY);
    if (원래.innerHeight) Object.defineProperty(window, "innerHeight", 원래.innerHeight);
    window.scrollTo = 원래.scrollTo;
    window.requestAnimationFrame = 원래.raf;
    window.cancelAnimationFrame = 원래.caf;
    document.body.innerHTML = "";
  });

  it("카드를 화면 위에서 조금 내려온 자리에 세운다", () => {
    끝 = 9000;
    카드놓기(4000);
    restoreToCard("card-8");
    프레임(3);

    // 800 의 30% = 240. 카드가 딱 맨 위에 붙으면 위 띠에 가린다.
    expect(y).toBe(4000 - 240);
  });

  it("카드가 아직 없으면 생길 때까지 기다린다", () => {
    끝 = 9000;
    restoreToCard("card-8");
    프레임(5);
    expect(y).toBe(0);

    // 목록이 도착했다.
    카드놓기(4000);
    프레임(3);
    expect(y).toBe(3760);
  });

  it("목록이 길어져 카드가 밀리면 따라간다", () => {
    // 사진도 권유 띠도 아직. 문서가 짧아 갈 수 있는 데까지만 간다.
    끝 = 500;
    카드놓기(4000);
    restoreToCard("card-8");
    프레임(2);
    expect(y).toBe(500);

    // 사진이 들어오고 권유 띠가 끼어들며 카드가 더 아래로 밀렸다.
    끝 = 12000;
    카드놓기(6000);
    프레임(3);
    expect(y).toBe(6000 - 240);
  });

  it("사람이 손을 대면 그만둔다", () => {
    끝 = 9000;
    카드놓기(4000);
    let 끝났나 = false;
    restoreToCard("card-8", () => {
      끝났나 = true;
    });
    프레임(3);
    expect(y).toBe(3760);

    window.dispatchEvent(new Event("wheel"));
    y = 400;
    프레임(5);

    expect(y).toBe(400);
    // 사람이 그만두라 한 것도 다 한 것이다. 적어 둔 여행은 지운다.
    expect(끝났나).toBe(true);
  });

  /*
    화면이 접히면서 손을 떼는 것은 "다 했다"가 아니다. 그때 적어 둔
    여행까지 지워 버리면, 곧바로 다시 그려질 때 돌아갈 곳을 잃는다.
  */
  it("도중에 걷히면 적어 둔 것을 지우지 않는다", () => {
    끝 = 9000;
    카드놓기(4000);
    let 끝났나 = false;
    const 걷기 = restoreToCard("card-8", () => {
      끝났나 = true;
    });
    프레임(2);
    걷기();

    expect(끝났나).toBe(false);
  });

  it("자리가 앉으면 일찍 그만둔다", () => {
    끝 = 9000;
    카드놓기(4000);
    let 끝났나 = false;
    restoreToCard("card-8", () => {
      끝났나 = true;
    });
    프레임(40);

    expect(y).toBe(3760);
    expect(대기).toHaveLength(0);
    expect(끝났나).toBe(true);
  });

  it("카드가 끝내 나타나지 않아도 언젠가 멈춘다", () => {
    끝 = 9000;
    restoreToCard("card-8");
    프레임(220);
    expect(대기).toHaveLength(0);
  });
});
