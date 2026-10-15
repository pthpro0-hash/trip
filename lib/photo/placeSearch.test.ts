import { describe, it, expect, vi, afterEach } from "vitest";
import { searchPlaces } from "./placeSearch";

afterEach(() => vi.unstubAllGlobals());

describe("searchPlaces", () => {
  it("검색어를 보내고 찾은 곳을 돌려준다", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => ({ places: [{ title: "경복궁", address: "서울", lat: 37.5, lng: 127, dong: "서울", spotId: null }] }) };
    });
    const found = await searchPlaces("  경복궁 ");
    expect(urls[0]).toBe("/api/place-search?q=%EA%B2%BD%EB%B3%B5%EA%B6%81");
    expect(found.map((place) => place.title)).toEqual(["경복궁"]);
  });

  it("찾은 것이 없으면 빈 목록이다", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ places: [] }) }));
    expect(await searchPlaces("없는곳")).toEqual([]);
  });

  it("서버가 막히면 던진다 — '없다'와 '못 물었다'는 다르다", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    await expect(searchPlaces("경복궁")).rejects.toThrow();
  });
});
