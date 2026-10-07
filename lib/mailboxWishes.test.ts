import { describe, it, expect } from "vitest";
import { groupWishes, isWishSpot, withWish, wishCount, wishedBy, type Wish } from "./mailboxWishes";
import { spotById, wishSpots } from "./wishSpots";

const wishes: Wish[] = [
  { who: "엄마", spot: "경복궁" },
  { who: "아빠", spot: "경복궁" },
  { who: "엄마", spot: "창덕궁과-후원" },
];

describe("mailboxWishes · 가고 싶은 곳을 세고 켜고 끈다", () => {
  it("곳마다 몇 분이 가고 싶어 하는지 센다", () => {
    expect(wishCount(wishes, "경복궁")).toBe(2);
    expect(wishCount(wishes, "창덕궁과-후원")).toBe(1);
    expect(wishCount(wishes, "경주")).toBe(0);
  });

  it("내가 고른 곳인지 안다", () => {
    expect(wishedBy(wishes, "엄마", "경복궁")).toBe(true);
    expect(wishedBy(wishes, "아빠", "창덕궁과-후원")).toBe(false);
  });

  it("켜면 더해지고 끄면 빠진다 — 이미 켠 것을 또 켜도 하나, 없는 것을 꺼도 그대로, 원래 목록은 안 바뀐다", () => {
    const before = JSON.stringify(wishes);
    const on = withWish(wishes, "아빠", "창덕궁과-후원", true);
    expect(wishCount(on, "창덕궁과-후원")).toBe(2);
    expect(withWish(on, "아빠", "창덕궁과-후원", true)).toHaveLength(on.length);
    expect(wishedBy(withWish(wishes, "엄마", "경복궁", false), "엄마", "경복궁")).toBe(false);
    expect(withWish(wishes, "아빠", "경주", false)).toEqual(wishes);
    expect(JSON.stringify(wishes)).toBe(before);
  });

  it("곳 이름은 길이 1~60, 슬래시·공백이 없어야 한다 — 서버(mailbox.sql)가 막는 모양과 같다", () => {
    expect(isWishSpot("경복궁")).toBe(true);
    expect(isWishSpot("창덕궁과-후원")).toBe(true);
    for (const bad of ["", "a/b", "a b", "가".repeat(61)]) expect(isWishSpot(bad)).toBe(false);
  });
});

describe("groupWishes · 보내는 사람이 읽는 줄", () => {
  const rows = [
    { id: "w1", mailboxId: "m1", who: "엄마", spot: "경복궁", at: "2026-10-03T00:00:00Z", seen: true },
    { id: "w2", mailboxId: "m1", who: "엄마", spot: "경주", at: "2026-10-04T00:00:00Z", seen: false },
    { id: "w3", mailboxId: "m1", who: "아빠", spot: "경복궁", at: "2026-10-05T00:00:00Z", seen: true },
    { id: "w4", mailboxId: "m2", who: "엄마", spot: "제주", at: "2026-10-06T00:00:00Z", seen: true },
  ];

  it("책장별로 모아 준다 — 순서는 고른 차례", () => {
    const byBox = groupWishes(rows);
    expect([...byBox.keys()]).toEqual(["m1", "m2"]);
    expect(byBox.get("m1")?.map((row) => row.id)).toEqual(["w1", "w2", "w3"]);
  });

  it("없으면 빈 표", () => {
    expect(groupWishes([]).size).toBe(0);
  });
});

describe("wishSpots · 고를 수 있는 곳(여행 100선)", () => {
  it("모두 서버가 받는 곳 이름 모양이다 — 고른 것이 DB 에서 거절되지 않게", () => {
    expect(wishSpots.length).toBeGreaterThan(100);
    for (const spot of wishSpots) expect(isWishSpot(spot.id), spot.id).toBe(true);
  });

  it("id 로 이름을 찾는다 — 모르는 id 는 없다", () => {
    expect(spotById("경복궁")?.name).toBe("경복궁");
    expect(spotById("없는곳")).toBeUndefined();
  });
});
