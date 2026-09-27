import { describe, it, expect } from "vitest";
import { settle, snapHeights } from "./HubSheet";

/*
  시트는 세 칸에서 멈춘다. 손을 뗀 자리와 빠르기로 칸을 고르는데,
  이건 손으로 해 보기 전에는 맞는지 알 수 없어 여기서 못 박는다.
*/
describe("snapHeights", () => {
  it("살짝 < 반쯤 < 끝까지", () => {
    const h = snapHeights(700);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThan(h.full);
    // 끝까지 올려도 지도가 한 줄은 보인다. 무엇 위에 떠 있는지 잊지 않게.
    expect(h.full).toBeLessThan(700);
  });

  it("아주 작은 화면에서도 칸이 뒤집히지 않는다", () => {
    const h = snapHeights(300);
    expect(h.peek).toBeLessThan(h.half);
    expect(h.half).toBeLessThanOrEqual(h.full);
  });
});

describe("settle", () => {
  const h = snapHeights(700);

  it("천천히 놓으면 가장 가까운 칸", () => {
    expect(settle(h.half + 20, 0, h)).toBe("half");
    expect(settle(h.peek + 10, 0, h)).toBe("peek");
  });

  it("휙 올리면 한 칸 더 간다", () => {
    // 반쯤 조금 위에서 위로 세게 튕겼다.
    expect(settle(h.half + 30, 1.5, h)).toBe("full");
  });

  it("휙 내리면 한 칸 더 내려간다", () => {
    expect(settle(h.half - 30, -1.5, h)).toBe("peek");
  });
});
