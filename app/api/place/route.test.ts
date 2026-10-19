// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/*
  좌표를 사람이 알아보는 장소 이름으로. 바깥(카카오)은 가짜로 바꾸고, 무엇을 묻고 어떤 이름을 돌려주는지 본다.
  200m 안에 아무것도 없으면 주소로 떨어지던 것을, 1.5km 안의 이름난 곳이 있으면 "근처"로 붙인다.
*/
interface Doc {
  place_name: string;
  distance: string;
}
let sights: Doc[] = [];
let culture: Doc[] = [];
const asked: string[] = [];

const REGION = {
  documents: [{ region_type: "B", region_1depth_name: "강원특별자치도", region_2depth_name: "강릉시", region_3depth_name: "견소동", region_4depth_name: "" }],
};

beforeEach(() => {
  sights = [];
  culture = [];
  asked.length = 0;
  process.env.KAKAO_REST_API_KEY = "test-key";
  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(decodeURIComponent(url));
    if (url.includes("coord2regioncode")) return { ok: true, json: async () => REGION };
    if (url.includes("category_group_code=AT4")) return { ok: true, json: async () => ({ documents: sights }) };
    return { ok: true, json: async () => ({ documents: culture }) };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.KAKAO_REST_API_KEY;
});

let counter = 0;
/** 시험마다 다른 좌표 — 서버가 100m 안은 한 번만 묻고 기억해 두기 때문이다. */
const call = async (count = 1) => {
  const { POST } = await import("./route");
  counter += 1;
  const points = Array.from({ length: count }, (_, i) => ({ lat: 37 + counter * 0.01 + i * 0.1, lng: 128.0 }));
  return POST(new Request("https://x.test/api/place", { method: "POST", body: JSON.stringify({ points }) }));
};
const answer = async (count = 1) => (await (await call(count)).json()).places[0];

describe("POST /api/place · 이름 붙이기", () => {
  it("바로 여기(200m 안)의 이름난 곳이 있으면 그 이름이다", async () => {
    sights = [{ place_name: "안목해변", distance: "99" }];
    expect(await answer()).toMatchObject({ title: "안목해변", kind: "here", isCuratedSpot: false });
  });

  it("후보를 1.5km 안까지 찾는다 — 예전에는 1km 였다", async () => {
    await answer();
    expect(asked.filter((url) => url.includes("category_group_code")).every((url) => url.includes("radius=1500"))).toBe(true);
  });

  it("여기엔 없고 1.5km 안에 이름난 곳이 있으면 '근처'를 붙인다 — 주소로 떨어지지 않는다", async () => {
    sights = [{ place_name: "한솔수목원", distance: "1300" }];
    expect(await answer()).toMatchObject({ title: "한솔수목원 근처", kind: "near", isCuratedSpot: false, spotId: null });
  });

  it("이름난 곳이 하나도 없으면 법정동 주소다", async () => {
    sights = [{ place_name: "사기장골", distance: "900" }];
    expect(await answer()).toMatchObject({ title: "강릉시 견소동", kind: "area" });
  });

  it("1.5km 안의 100선은 100선 이름으로 근처를 붙인다 — 수목원 이름이 100선의 일부여도 100선 이름이 먼저다", async () => {
    sights = [{ place_name: "남이섬수목원", distance: "1300" }];
    const place = await answer();
    expect(place).toMatchObject({ title: "남이섬 근처", kind: "near", isCuratedSpot: false, spotId: null });
  });

  it("100선이 여기 있으면 100선이고 그 id 를 준다", async () => {
    sights = [{ place_name: "경복궁", distance: "50" }];
    const place = await answer();
    expect(place).toMatchObject({ title: "경복궁", kind: "spot", isCuratedSpot: true });
    expect(place.spotId).toEqual(expect.any(String));
  });

  it("고칠 때 고를 후보를 주변 이름난 곳으로 준다 — 지금 이름은 빼고", async () => {
    sights = [
      { place_name: "안목해변", distance: "99" },
      { place_name: "강릉카페거리", distance: "24" },
    ];
    culture = [{ place_name: "환희컵박물관", distance: "401" }];
    const place = await answer();
    expect(place.title).toBe("안목해변");
    expect(place.candidates).not.toContain("안목해변");
    expect(place.candidates).toContain("강릉카페거리");
    expect(place.candidates.length).toBeLessThanOrEqual(4);
  });

  it("'근처' 이름의 후보에는 근처의 그 이름이 다시 나오지 않는다", async () => {
    sights = [{ place_name: "한솔수목원", distance: "1300" }, { place_name: "무릉공원", distance: "1400" }];
    const place = await answer();
    // 이름이 짧고 장소를 부르는 말(공원)로 끝나는 쪽이 이긴다.
    expect(place.title).toBe("무릉공원 근처");
    expect(place.candidates).toEqual(["한솔수목원"]);
  });

  it("한국 밖 좌표와 너무 많은 좌표는 거절한다 — 아무나 쓰는 프록시가 되지 않게", async () => {
    const { POST } = await import("./route");
    const abroad = await POST(new Request("https://x.test/api/place", { method: "POST", body: JSON.stringify({ points: [{ lat: 51.5, lng: -0.17 }] }) }));
    expect(abroad.status).toBe(400);
    const many = await POST(new Request("https://x.test/api/place", { method: "POST", body: JSON.stringify({ points: Array.from({ length: 26 }, () => ({ lat: 37.5, lng: 127 })) }) }));
    expect(many.status).toBe(400);
  });

  it("키가 없으면 503", async () => {
    delete process.env.KAKAO_REST_API_KEY;
    expect((await call()).status).toBe(503);
  });
});
