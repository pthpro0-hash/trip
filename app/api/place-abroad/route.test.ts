// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/*
  해외 좌표를 "영국 런던"처럼 나라와 지역 이름으로. 바깥(Nominatim)은 가짜로 바꾸고, 무엇을 묻고 무엇을 거절하는지 본다.
  초당 한 번 규칙 때문에 연달아 묻는 시험은 조금 걸린다.
*/
const asked: string[] = [];
let answer: unknown = { address: { country: "영국", city: "런던" } };
let ok = true;

beforeEach(() => {
  asked.length = 0;
  answer = { address: { country: "영국", city: "런던" } };
  ok = true;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    asked.push(`${url}|${(init.headers as Record<string, string>)["User-Agent"]}`);
    return { ok, json: async () => answer };
  });
});
afterEach(() => vi.unstubAllGlobals());

const call = async (points: unknown) => {
  const { POST } = await import("./route");
  return POST(new Request("https://x.test/api/place-abroad", { method: "POST", body: JSON.stringify({ points }) }));
};

describe("POST /api/place-abroad", () => {
  it("나라와 지역을 합쳐 이름으로 돌려준다 — 좌표는 뭉개지 않고 그대로 묻고, 앱을 알아볼 이름을 단다", async () => {
    const response = await call([{ lat: 51.50123, lng: -0.17456 }]);
    expect(response.status).toBe(200);
    expect((await response.json()).places[0]).toEqual({ title: "영국 런던", isCuratedSpot: false, spotId: null, dong: "영국 런던" });
    expect(asked[0]).toContain("lat=51.50123");
    expect(asked[0]).toContain("lon=-0.17456");
    expect(asked[0]).toContain("zoom=18");
    expect(asked[0]).toContain("accept-language=ko");
    expect(asked[0]).toContain("yeohaeng-sesang");
  });

  it("나라 이름이 영어로 와도 나라 코드로 한글을 쓴다", async () => {
    answer = { address: { country: "United States", country_code: "us", city: "뉴욕" } };
    const body = await (await call([{ lat: 40.71, lng: -74.01 }])).json();
    expect(body.places[0].title).toBe("미국 뉴욕");
  });

  it("도시가 없으면 읍·마을·구역·군·주 순으로, 나라와 같은 이름은 한 번만", async () => {
    answer = { address: { country: "모나코", suburb: "모나코" } };
    const response = await call([{ lat: 43.7384, lng: 7.4246 }]);
    expect((await response.json()).places[0].title).toBe("모나코");
  }, 10_000);

  it("런던의 구(시티오브웨스트민스터 등)는 사람이 부르는 이름 '런던'으로", async () => {
    answer = { display_name: "시티오브웨스트민스터, 그레이터런던, 잉글랜드, 영국", address: { country: "영국", city: "시티오브웨스트민스터" } };
    const response = await call([{ lat: 51.5014, lng: -0.1775 }]);
    expect((await response.json()).places[0].title).toBe("영국 런던");
  }, 10_000);

  it("세부 지역명 — 구역과 그 자리의 이름(명소·건물)까지 붙인다", async () => {
    answer = { name: "로열 앨버트 홀", display_name: "로열 앨버트 홀, 켄싱턴, 그레이터런던, 영국", address: { country: "영국", city: "시티오브웨스트민스터", suburb: "켄싱턴", road: "케닝턴 로드" } };
    const response = await call([{ lat: 51.50102, lng: -0.17737 }]);
    const place = (await response.json()).places[0];
    expect(place.title).toBe("영국 런던 켄싱턴 로열 앨버트 홀");
    expect(place.dong).toBe("영국 런던 켄싱턴");
  }, 10_000);

  it("이름 있는 곳이 아니면 길 이름으로", async () => {
    answer = { name: "", address: { country: "일본", city: "시부야구", road: "메이지도리" } };
    const response = await call([{ lat: 35.6702, lng: 139.7027 }]);
    expect((await response.json()).places[0].title).toBe("일본 시부야구 메이지도리");
  }, 10_000);

  it("똑같은 좌표는 한 번만 묻고, 조금이라도 다른 좌표는 따로 묻는다 — 뭉개서 같은 곳으로 보지 않는다", async () => {
    await call([{ lat: 35.6595, lng: 139.7005 }]);
    const before = asked.length;
    await call([{ lat: 35.6595, lng: 139.7005 }]);
    expect(asked.length).toBe(before);
    await call([{ lat: 35.6601, lng: 139.7011 }]);
    expect(asked.length).toBe(before + 1);
  }, 10_000);

  it("못 알아내면 '해외'로 알린다 — 한국의 '알 수 없는 곳'보다 낫다", async () => {
    ok = false;
    const response = await call([{ lat: -33.86, lng: 151.21 }]);
    expect((await response.json()).places[0].title).toBe("해외");
  }, 10_000);

  it("한국 안의 좌표·잘못된 값·너무 많은 좌표는 받지 않는다 — 남의 조회를 대신해 주는 문이 되지 않게", async () => {
    expect((await call([{ lat: 37.57, lng: 126.98 }])).status).toBe(400);
    expect((await call([{ lat: "x", lng: 1 }])).status).toBe(400);
    expect((await call([{ lat: 95, lng: 10 }])).status).toBe(400);
    expect((await call([])).status).toBe(400);
    expect((await call(Array.from({ length: 11 }, () => ({ lat: 48.86, lng: 2.35 })))).status).toBe(400);
    expect(asked).toHaveLength(0);
  });
});
