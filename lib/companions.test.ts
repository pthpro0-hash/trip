// @vitest-environment node
import { describe, it, expect } from "vitest";
import { companionSuggestions } from "./companions";

describe("companionSuggestions", () => {
  it("자주 적은 이름부터 — 앞뒤 빈칸은 같은 이름으로 센다", () => {
    expect(companionSuggestions(["민수", "가족", "민수 ", null, "민수"], "")[0]).toBe("민수");
    expect(companionSuggestions(["민수", "가족", "민수 "], "").filter((name) => name === "민수")).toHaveLength(1);
  });

  it("적은 적이 없으면 흔한 말로 채운다", () => {
    expect(companionSuggestions([], "")).toEqual(["혼자", "가족", "친구", "연인"]);
  });

  it("지금 값은 빼고, max 개까지", () => {
    const names = companionSuggestions(["가", "나", "다", "라", "마", "바", "사"], "가", 3);
    expect(names).not.toContain("가");
    expect(names).toHaveLength(3);
  });
});
