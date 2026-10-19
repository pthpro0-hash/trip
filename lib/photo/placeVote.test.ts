import { describe, it, expect } from "vitest";
import { samplePoints, voteAnswer, type PlaceAnswer } from "./placeVote";

/*
  한 방문의 이름을 첫 사진 한 장이 아니라 여러 장으로 정한다. 한 장이 길가에서 찍혀 주소로 떨어져도 다른 장이 이름난 곳을 찾으면 그 이름이다.
*/
const answer = (title: string, kind: PlaceAnswer["kind"], extra: Partial<PlaceAnswer> = {}): PlaceAnswer => ({
  title,
  isCuratedSpot: kind === "spot",
  spotId: null,
  dong: null,
  kind,
  ...extra,
});

describe("samplePoints", () => {
  const at = (n: number) => ({ lat: 37 + n * 0.01, lng: 127 });

  it("앞 · 가운데 · 끝 석 장", () => {
    const shots = Array.from({ length: 9 }, (_, i) => at(i));
    expect(samplePoints(shots)).toEqual([shots[0], shots[4], shots[8]]);
  });

  it("같은 자리(100m 안)는 한 번만 — 사진이 한 곳에서 몰려 찍혔으면 한 장 값이다", () => {
    const same = Array.from({ length: 6 }, () => ({ lat: 37.5001, lng: 127.0001 }));
    expect(samplePoints(same)).toHaveLength(1);
  });

  it("한두 장이면 있는 만큼", () => {
    expect(samplePoints([at(0)])).toHaveLength(1);
    expect(samplePoints([at(0), at(5)])).toHaveLength(2);
    expect(samplePoints([])).toEqual([]);
  });
});

describe("voteAnswer", () => {
  it("한 장뿐이면 그대로", () => {
    const only = answer("경복궁", "spot");
    expect(voteAnswer([only])).toBe(only);
  });

  it("한 장이 주소여도 다른 장이 이름난 곳을 찾았으면 그 이름이다", () => {
    const winner = voteAnswer([answer("광주시 문형동", "area"), answer("서랑말링산", "here"), answer("광주시 문형동", "area")]);
    // 주소가 두 장이어도 종류가 더 쓸 만한 이름이 이긴다.
    expect(winner.title).toBe("서랑말링산");
  });

  it("100선 > 바로 여기 > 근처 > 주소 순서", () => {
    expect(voteAnswer([answer("무릉공원 근처", "near"), answer("안목해변", "here")]).title).toBe("안목해변");
    expect(voteAnswer([answer("안목해변", "here"), answer("경복궁", "spot")]).title).toBe("경복궁");
    expect(voteAnswer([answer("강릉시 견소동", "area"), answer("무릉공원 근처", "near")]).title).toBe("무릉공원 근처");
  });

  it("같은 종류끼리는 더 많은 장이 가리킨 이름 — 같으면 먼저 찍은 장", () => {
    expect(voteAnswer([answer("가해변", "here"), answer("나해변", "here"), answer("나해변", "here")]).title).toBe("나해변");
    expect(voteAnswer([answer("가해변", "here"), answer("나해변", "here")]).title).toBe("가해변");
  });

  it("종류를 모르는 답(해외·옛 응답)은 곳 이름이 붙은 것으로 본다 — 주소 종류에 지지 않는다", () => {
    const unknown: PlaceAnswer = { title: "영국 런던", isCuratedSpot: false, spotId: null, dong: "영국 런던" };
    expect(voteAnswer([answer("어느 동", "area"), unknown]).title).toBe("영국 런던");
  });

  it("후보는 모든 장의 후보와 다른 이름난 답을 모아, 많이 나온 차례로 — 고른 이름은 뺀다", () => {
    const merged = voteAnswer([
      answer("안목해변", "here", { candidates: ["강릉카페거리", "환희컵박물관"] }),
      answer("강릉카페거리", "here", { candidates: ["안목해변", "환희컵박물관"] }),
      answer("강릉시 견소동", "area", { candidates: ["환희컵박물관"] }),
    ]);
    expect(merged.title).toBe("안목해변");
    // 환희컵박물관이 석 장 모두에, 강릉카페거리가 두 장(후보 + 답)에 나온다. 주소는 후보가 아니다.
    expect(merged.candidates).toEqual(["환희컵박물관", "강릉카페거리"]);
  });

  it("'근처' 이름이 이기면 그 기본 이름은 후보에서 뺀다", () => {
    const merged = voteAnswer([answer("무릉공원 근처", "near", { candidates: ["무릉공원", "한솔수목원"] }), answer("강릉시 견소동", "area")]);
    expect(merged.title).toBe("무릉공원 근처");
    expect(merged.candidates).toEqual(["한솔수목원"]);
  });

  it("후보는 최대 4개", () => {
    const many = voteAnswer([answer("가해변", "here", { candidates: ["a", "b", "c", "d", "e", "f"] }), answer("나해변", "here")]);
    expect(many.candidates!.length).toBeLessThanOrEqual(4);
  });

  it("답이 하나도 없으면 던진다 — 부르는 쪽이 비어 있지 않게 건넨다", () => {
    expect(() => voteAnswer([])).toThrow();
  });
});
