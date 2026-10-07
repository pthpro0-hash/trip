import { describe, it, expect } from "vitest";
import { heartCount, heartedBy, heartNames, isHeartFile, summarizeHearts, withHeart, type Heart } from "./mailboxHearts";

const hearts: Heart[] = [
  { who: "엄마", file: "a.webp" },
  { who: "아빠", file: "a.webp" },
  { who: "엄마", file: "b.webp" },
  { who: "엄마", file: "" },
];

describe("mailboxHearts · 받는 쪽에서 하트를 세고 켜고 끈다", () => {
  it("사진마다 하트가 몇 개인지 센다 — 책 하트(빈 글자)는 따로", () => {
    expect(heartCount(hearts, "a.webp")).toBe(2);
    expect(heartCount(hearts, "b.webp")).toBe(1);
    expect(heartCount(hearts, "c.webp")).toBe(0);
    expect(heartCount(hearts, "")).toBe(1);
  });

  it("내가 단 하트인지 안다", () => {
    expect(heartedBy(hearts, "엄마", "a.webp")).toBe(true);
    expect(heartedBy(hearts, "아빠", "b.webp")).toBe(false);
    expect(heartedBy(hearts, "아빠", "")).toBe(false);
  });

  it("누가 달았는지 이름들을 준다 — 순서는 단 차례, 같은 이름은 한 번만", () => {
    expect(heartNames(hearts, "a.webp")).toEqual(["엄마", "아빠"]);
    expect(heartNames([...hearts, { who: "엄마", file: "a.webp" }], "a.webp")).toEqual(["엄마", "아빠"]);
    expect(heartNames(hearts, "c.webp")).toEqual([]);
  });

  it("켜면 더해지고 끄면 빠진다 — 이미 켠 것을 또 켜도 한 개, 없는 것을 꺼도 그대로", () => {
    const on = withHeart(hearts, "아빠", "b.webp", true);
    expect(heartCount(on, "b.webp")).toBe(2);
    expect(withHeart(on, "아빠", "b.webp", true)).toHaveLength(on.length);
    const off = withHeart(hearts, "엄마", "a.webp", false);
    expect(heartedBy(off, "엄마", "a.webp")).toBe(false);
    expect(heartedBy(off, "아빠", "a.webp")).toBe(true);
    expect(withHeart(hearts, "아빠", "zzz.webp", false)).toEqual(hearts);
  });

  it("원래 목록은 바꾸지 않는다", () => {
    const before = JSON.stringify(hearts);
    withHeart(hearts, "아빠", "b.webp", true);
    withHeart(hearts, "엄마", "a.webp", false);
    expect(JSON.stringify(hearts)).toBe(before);
  });

  it("하트 파일 이름은 빈 글자(책 하트)이거나 안전한 파일 이름이어야 한다", () => {
    expect(isHeartFile("")).toBe(true);
    expect(isHeartFile("a.webp")).toBe(true);
    expect(isHeartFile("../a.webp")).toBe(false);
    expect(isHeartFile("a/b.webp")).toBe(false);
    expect(isHeartFile("x".repeat(81))).toBe(false);
  });
});

describe("summarizeHearts · 보낸 사람이 보는 하트 한 줄", () => {
  const rows = [
    { id: "h1", mailboxId: "m1", who: "엄마", file: "a.webp", seen: true },
    { id: "h2", mailboxId: "m1", who: "엄마", file: "b.webp", seen: false },
    { id: "h3", mailboxId: "m1", who: "아빠", file: "", seen: true },
    { id: "h4", mailboxId: "m2", who: "엄마", file: "a.webp", seen: true },
  ];

  it("(책장, 이름)마다 한 줄 — 사진 하트는 몇 장인지, 책 하트는 책 하나", () => {
    expect(summarizeHearts(rows)).toEqual([
      { mailboxId: "m1", who: "엄마", photos: 2, book: false, ids: ["h1", "h2"] },
      { mailboxId: "m1", who: "아빠", photos: 0, book: true, ids: ["h3"] },
      { mailboxId: "m2", who: "엄마", photos: 1, book: false, ids: ["h4"] },
    ]);
  });

  it("하트가 없으면 빈 목록", () => {
    expect(summarizeHearts([])).toEqual([]);
  });
});
