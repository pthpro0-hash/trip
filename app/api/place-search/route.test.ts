// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/*
  장소 이름으로 좌표를 찾는다. 바깥(카카오)은 가짜로 바꾸고, 무엇을 묻고 무엇을 거절하는지 본다.
*/
const asked: { url: string; auth: string }[] = [];
let documents: unknown[] = [];
let ok = true;

beforeEach(() => {
  asked.length = 0;
  documents = [
    { place_name: "경복궁", address_name: "서울 종로구 세종로 1-91", road_address_name: "서울 종로구 사직로 161", x: "126.977", y: "37.5796" },
  ];
  ok = true;
  process.env.KAKAO_REST_API_KEY = "test-key";
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    asked.push({ url, auth: (init.headers as Record<string, string>).Authorization });
    return { ok, json: async () => ({ documents }) };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.KAKAO_REST_API_KEY;
});

const call = async (q?: string) => {
  const { GET } = await import("./route");
  const url = new URL("https://x.test/api/place-search");
  if (q !== undefined) url.searchParams.set("q", q);
  return GET(new Request(url));
};

describe("GET /api/place-search", () => {
  it("검색어로 찾은 곳의 이름·주소·좌표를 돌려준다 — 키는 서버에서만 쓴다", async () => {
    const response = await call("경복궁");
    expect(response.status).toBe(200);
    const { places } = await response.json();
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ title: "경복궁", address: "서울 종로구 사직로 161", lat: 37.5796, lng: 126.977, dong: "서울 종로구 세종로" });
    expect(asked[0].url).toContain("search/keyword.json");
    expect(decodeURIComponent(asked[0].url)).toContain("query=경복궁");
    expect(asked[0].auth).toBe("KakaoAK test-key");
  });

  it("여행 100선에 있는 이름이면 그 id 를 함께 준다", async () => {
    const { places } = await (await call("경복궁")).json();
    expect(places[0].spotId).toEqual(expect.any(String));
  });

  it("100선에 없는 곳은 spotId 가 비어 있다", async () => {
    documents = [{ place_name: "동네 분식집", address_name: "서울 마포구 동교동 1", x: "126.92", y: "37.55" }];
    const { places } = await (await call("동네 분식집")).json();
    expect(places[0].spotId).toBeNull();
    expect(places[0].address).toBe("서울 마포구 동교동 1");
  });

  it("한국 밖 좌표와 좌표를 못 읽는 것은 걸러 낸다", async () => {
    documents = [
      { place_name: "에펠탑", address_name: "파리", x: "2.29", y: "48.86" },
      { place_name: "좌표 없음", address_name: "서울" },
      { place_name: "경복궁", address_name: "서울 종로구 세종로 1-91", x: "126.977", y: "37.5796" },
    ];
    const { places } = await (await call("탑")).json();
    expect(places.map((place: { title: string }) => place.title)).toEqual(["경복궁"]);
  });

  it("검색어가 없거나 너무 길면 묻지도 않고 거절한다 — 아무 말이나 받아 주는 프록시가 아니다", async () => {
    expect((await call()).status).toBe(400);
    expect((await call("  ")).status).toBe(400);
    expect((await call("가".repeat(41))).status).toBe(400);
    expect(asked).toHaveLength(0);
  });

  it("카카오가 막히면 502 로 알린다", async () => {
    ok = false;
    expect((await call("경복궁")).status).toBe(502);
  });

  it("키가 없으면 503 이다", async () => {
    delete process.env.KAKAO_REST_API_KEY;
    expect((await call("경복궁")).status).toBe(503);
  });
});
