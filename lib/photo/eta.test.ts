// @vitest-environment node
import { describe, it, expect } from "vitest";
import { remainingText } from "./eta";

describe("remainingText", () => {
  it("몇 장 올려 보기 전에는 어림하지 않는다", () => {
    // 첫 장이 유난히 느려 "20분" 이 떴다가 곧 3분으로 바뀌는 것을 막는다.
    expect(remainingText(1, 200, 6_000)).toBeNull();
    expect(remainingText(4, 200, 4_000)).toBeNull();
  });

  it("한 장에 1초면 200장 중 5장 올렸을 때 4분쯤", () => {
    expect(remainingText(5, 200, 5_000)).toBe("4분쯤 남았어요");
  });

  it("1분 안쪽은 5초 단위로 말한다", () => {
    expect(remainingText(10, 40, 10_000)).toBe("30초쯤 남았어요");
  });

  it("코앞이면 수를 말하지 않는다", () => {
    expect(remainingText(95, 100, 95_000)).toBe("곧 끝나요");
  });

  it("다 올렸으면 말할 것이 없다", () => {
    expect(remainingText(200, 200, 60_000)).toBeNull();
  });
});
