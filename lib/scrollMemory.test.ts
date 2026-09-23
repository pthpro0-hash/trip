import { describe, it, expect, beforeEach } from "vitest";
import { askRestore, rememberScroll, takeScroll } from "./scrollMemory";

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
