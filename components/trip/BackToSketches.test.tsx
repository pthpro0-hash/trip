import { describe, it, expect } from "vitest";
import { backLabel } from "./BackToSketches";

describe("backLabel", () => {
  it("같은 이름 모아 보기에서 왔으면 그 곳 이름으로 돌아간다", () => {
    expect(backLabel(`/places?name=${encodeURIComponent("안목해변")}`)).toBe("← 안목해변");
  });

  it("그 밖에는 내 스케치", () => {
    expect(backLabel("/trips")).toBe("← 내 스케치");
    expect(backLabel("/?v=sketch")).toBe("← 내 스케치");
    expect(backLabel(null)).toBe("← 내 스케치");
  });
});
