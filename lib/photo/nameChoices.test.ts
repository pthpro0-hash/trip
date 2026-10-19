import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchNameChoices } from "./nameChoices";

afterEach(() => vi.unstubAllGlobals());

const answer = (place: Record<string, unknown>) => {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return { ok: true, json: async () => ({ places: [place] }) };
  });
  return calls;
};

describe("fetchNameChoices · 이름을 고칠 때 눌러서 고를 후보", () => {
  it("그 자리 좌표로 한 번 묻는다", async () => {
    const calls = answer({ title: "안목해변", kind: "here", candidates: ["강릉카페거리"] });
    await fetchNameChoices(37.77, 128.95, "다른 이름");
    expect(calls).toEqual([{ url: "/api/place", body: { points: [{ lat: 37.77, lng: 128.95 }] } }]);
  });

  it("이름난 곳으로 붙은 이름이 맨 앞, 그다음 주변 후보 — 지금 이름은 뺀다", async () => {
    answer({ title: "안목해변", kind: "here", candidates: ["강릉카페거리", "환희컵박물관"] });
    expect(await fetchNameChoices(37.77, 128.95, "강릉카페거리")).toEqual(["안목해변", "환희컵박물관"]);
  });

  it("'근처'로 붙은 이름은 그대로 보인다", async () => {
    answer({ title: "경포대 근처", kind: "near", candidates: [] });
    expect(await fetchNameChoices(37.77, 128.95, "강릉시 견소동")).toEqual(["경포대 근처"]);
  });

  it("주소로 물러난 이름은 후보가 아니다", async () => {
    answer({ title: "강릉시 견소동", kind: "area", candidates: ["환희컵박물관"] });
    expect(await fetchNameChoices(37.77, 128.95, "x")).toEqual(["환희컵박물관"]);
  });

  it("종류를 모르는 옛 응답은 후보만 쓴다", async () => {
    answer({ title: "아무개", candidates: ["가", "나"] });
    expect(await fetchNameChoices(37.77, 128.95, "x")).toEqual(["가", "나"]);
  });

  it("한국 밖이면 묻지 않는다", async () => {
    const calls = answer({ title: "x", kind: "here" });
    expect(await fetchNameChoices(51.5, -0.17, "런던")).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("못 묻거나 이상한 답이면 빈 목록 — 고치기가 막히지 않는다", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("망");
    });
    expect(await fetchNameChoices(37.77, 128.95, "x")).toEqual([]);
    vi.stubGlobal("fetch", async () => ({ ok: false, json: async () => ({}) }));
    expect(await fetchNameChoices(37.77, 128.95, "x")).toEqual([]);
    vi.stubGlobal("fetch", async () => ({ ok: true, json: async () => ({ places: [] }) }));
    expect(await fetchNameChoices(37.77, 128.95, "x")).toEqual([]);
  });

  it("최대 5개", async () => {
    answer({ title: "가", kind: "here", candidates: ["나", "다", "라", "마", "바", "사"] });
    expect(await fetchNameChoices(37.77, 128.95, "x")).toHaveLength(5);
  });
});
