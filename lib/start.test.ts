import { describe, it, expect } from "vitest";
import { startHref, startOf } from "./start";

describe("startOf", () => {
  it("아무것도 없으면 여행 100선 — 검색엔진이 보는 화면이다", () => {
    expect(startOf(undefined, undefined)).toBe("spots");
  });

  it("한 번 고른 갈래로 다음에도 연다", () => {
    expect(startOf(undefined, "sketch")).toBe("sketch");
  });

  it("주소에 적힌 갈래가 기억보다 앞선다 — 건네받은 링크는 건넨 사람의 화면이어야 한다", () => {
    expect(startOf("spots", "sketch")).toBe("spots");
    expect(startOf("sketch", "spots")).toBe("sketch");
  });

  it("엉뚱한 값은 없는 것으로 친다", () => {
    expect(startOf("해킹", "뭔가")).toBe("spots");
  });
});

describe("startHref", () => {
  it("갈래를 주소에 적는다", () => {
    expect(startHref("sketch")).toBe("/?v=sketch");
    expect(startHref("spots")).toBe("/?v=spots");
  });
});
