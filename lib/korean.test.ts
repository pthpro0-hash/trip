// @vitest-environment node
import { describe, it, expect } from "vitest";
import { attachParticle, companionLabel } from "./korean";

describe("attachParticle", () => {
  it("받침이 있으면 앞쪽, 없으면 뒤쪽", () => {
    expect(attachParticle("가족", "과", "와")).toBe("가족과");
    expect(attachParticle("민수", "과", "와")).toBe("민수와");
  });

  it("ㄹ 받침을 받침 없는 것처럼 다룰 수 있다 — '-로/-으로'가 그렇다", () => {
    expect(attachParticle("카카오맵", "으로", "로", true)).toBe("카카오맵으로");
    expect(attachParticle("네이버지도", "으로", "로", true)).toBe("네이버지도로");
    expect(attachParticle("서울", "으로", "로", true)).toBe("서울로");
  });

  it("ㄹ 예외를 끄면 ㄹ도 받침으로 본다", () => {
    expect(attachParticle("서울", "과", "와")).toBe("서울과");
  });

  it("한글이 아니면 받침 없는 쪽", () => {
    expect(attachParticle("Google", "과", "와")).toBe("Google와");
    expect(attachParticle("2026", "과", "와")).toBe("2026와");
  });

  it("빈 문자열도 무너지지 않는다", () => {
    expect(attachParticle("", "과", "와")).toBe("와");
  });
});

describe("companionLabel", () => {
  it("받침에 맞는 조사를 쓴다", () => {
    expect(companionLabel("가족")).toBe("가족과 함께");
    expect(companionLabel("민수")).toBe("민수와 함께");
  });

  it("혼자 다녀온 여행에 '혼자와 함께'라고 적지 않는다", () => {
    expect(companionLabel("혼자")).toBe("혼자");
    expect(companionLabel(" 혼자 ")).toBe("혼자");
  });

  it("적지 않았으면 아무 말도 하지 않는다", () => {
    expect(companionLabel("")).toBe("");
    expect(companionLabel("   ")).toBe("");
  });

  it("여러 명을 적어도 그대로 이어 붙인다", () => {
    expect(companionLabel("엄마, 동생")).toBe("엄마, 동생과 함께");
  });
});
