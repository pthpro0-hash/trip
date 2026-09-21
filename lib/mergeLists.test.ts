// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mergeLists, sameList } from "./mergeLists";

describe("mergeLists", () => {
  it("처음 로그인 — 계정이 비어 있으면 기기 것이 그대로 올라간다", () => {
    expect(mergeLists(["교동도", "경복궁"], [])).toEqual(["교동도", "경복궁"]);
  });

  it("다른 기기 — 기기가 비어 있으면 계정 것이 그대로 내려온다", () => {
    expect(mergeLists([], ["교동도", "경복궁"])).toEqual(["교동도", "경복궁"]);
  });

  it("둘 다 있으면 계정 순서를 지키고 기기 것을 뒤에 붙인다", () => {
    expect(mergeLists(["남이섬", "경복궁"], ["경복궁", "교동도"])).toEqual([
      "경복궁",
      "교동도",
      "남이섬",
    ]);
  });

  it("어느 쪽에 있던 것도 사라지지 않는다", () => {
    const local = ["가", "나", "다"];
    const remote = ["다", "라"];
    const merged = mergeLists(local, remote);
    for (const id of [...local, ...remote]) expect(merged).toContain(id);
  });

  it("같은 것이 두 번 들어가지 않는다", () => {
    const merged = mergeLists(["가", "나"], ["나", "가"]);
    expect(merged).toEqual(["나", "가"]);
    expect(new Set(merged).size).toBe(merged.length);
  });

  it("기기 안에 중복이 있어도 한 번만 남는다", () => {
    expect(mergeLists(["가", "가", "나"], [])).toEqual(["가", "나"]);
  });

  it("둘 다 비어 있으면 빈 목록", () => {
    expect(mergeLists([], [])).toEqual([]);
  });

  it("원본을 건드리지 않는다", () => {
    const local = ["가"];
    const remote = ["나"];
    mergeLists(local, remote);
    expect(local).toEqual(["가"]);
    expect(remote).toEqual(["나"]);
  });

  it("합친 결과는 언제나 양쪽을 합친 것보다 작지 않다", () => {
    const local = ["가", "나"];
    const remote = ["나", "다", "라"];
    expect(mergeLists(local, remote)).toHaveLength(new Set([...local, ...remote]).size);
  });
});

describe("sameList", () => {
  it("같으면 참", () => {
    expect(sameList(["가", "나"], ["가", "나"])).toBe(true);
  });

  it("순서가 다르면 거짓 — 이번 여행은 순서가 전부다", () => {
    expect(sameList(["가", "나"], ["나", "가"])).toBe(false);
  });

  it("길이가 다르면 거짓", () => {
    expect(sameList(["가"], ["가", "나"])).toBe(false);
  });

  it("둘 다 비어 있으면 참", () => {
    expect(sameList([], [])).toBe(true);
  });
});
