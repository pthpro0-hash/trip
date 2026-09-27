// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fitText, textWidth, wrapWords } from "./svgText";

describe("fitText", () => {
  it("들어가면 그대로", () => {
    expect(fitText("안목해변", 200, 15)).toBe("안목해변");
  });

  it("넘치면 잘라서 … 를 붙이고, 폭을 넘지 않는다", () => {
    const text = "강릉 안목해변 커피거리 앞 모래사장";
    const fitted = fitText(text, 120, 15);
    expect(fitted.endsWith("…")).toBe(true);
    expect(fitted.length).toBeLessThan(text.length);
    expect(textWidth(fitted, 15)).toBeLessThanOrEqual(120);
  });

  it("한글은 영문보다 넓게 어림한다", () => {
    expect(textWidth("가나다", 20)).toBeGreaterThan(textWidth("abc", 20));
  });
});

describe("wrapWords", () => {
  const names = ["서울", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

  it("폭 안이면 한 줄", () => {
    expect(wrapWords(["서울", "강원"], 600, 18)).toEqual(["서울 · 강원"]);
  });

  it("넘치면 낱말 단위로 다음 줄에 — 어느 줄도 폭을 넘지 않는다", () => {
    const lines = wrapWords(names, 200, 18);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" · ").split(" · ")).toEqual(names);
    for (const line of lines) expect(textWidth(line, 18)).toBeLessThanOrEqual(200);
  });

  it("줄이 모자라면 남은 수로 맺는다", () => {
    const lines = wrapWords(names, 200, 18, { maxLines: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/외 \d+곳$/);
    for (const line of lines) expect(textWidth(line, 18)).toBeLessThanOrEqual(200);
    const shown = lines.join(" · ").split(" · ").filter((word) => !word.startsWith("외 "));
    const left = Number(lines[1].match(/외 (\d+)곳$/)![1]);
    expect(shown.length + left).toBe(names.length);
  });
});
