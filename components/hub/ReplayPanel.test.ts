import { describe, it, expect } from "vitest";
import { stampLabel } from "./ReplayPanel";

describe("stampLabel", () => {
  it("날짜 · 요일 · 오전오후 몇 시", () => {
    // 2026-09-14 은 월요일이다.
    expect(stampLabel("2026-09-14 06:11:00")).toBe("2026.09.14 (월) 오전 6시");
    expect(stampLabel("2026-09-14 13:40:00")).toBe("2026.09.14 (월) 오후 1시");
  });

  it("자정과 정오는 12시", () => {
    expect(stampLabel("2026-09-14 00:10:00")).toBe("2026.09.14 (월) 오전 12시");
    expect(stampLabel("2026-09-14 12:10:00")).toBe("2026.09.14 (월) 오후 12시");
  });

  it("읽지 못하면 날짜만", () => {
    expect(stampLabel("2026-09-14 엉망")).toBe("2026.09.14");
  });
});
