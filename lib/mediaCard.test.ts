// @vitest-environment node
import { describe, it, expect } from "vitest";
import mediaData from "./data/spot-media.json";
import cardData from "./data/spot-card.json";
import overviewData from "./data/spot-overview.json";
import { getSpotAddress, getSpotThumbnail } from "./mediaCard";
import type { SpotMedia } from "./types";

/*
  첫 화면이 쓰는 작은 파일 둘(카드용 spot-card.json · 검색용 spot-overview.json)은 spot-media.json 에서 만든다.
  자료를 새로 받고(fetch-tour-media) 이 둘이 따라오지 않으면 카드 사진·주소·검색이 조용히 옛것이 된다 — 여기서 막는다.
*/
const MEDIA = mediaData as Record<string, SpotMedia>;
const CARD = cardData as Record<string, { t?: string; a: string }>;
const OVERVIEW = overviewData as Record<string, string>;

describe("spot-card.json · spot-overview.json", () => {
  it("spot-media.json 과 같은 곳들을 담는다", () => {
    expect(Object.keys(CARD).sort()).toEqual(Object.keys(MEDIA).sort());
    expect(Object.keys(OVERVIEW).sort()).toEqual(Object.keys(MEDIA).sort());
  });

  it("카드의 사진·주소와 소개글이 spot-media.json 과 같다", () => {
    for (const [id, media] of Object.entries(MEDIA)) {
      expect(CARD[id].t, `${id} 사진`).toBe(media.images[0]?.url);
      expect(CARD[id].a, `${id} 주소`).toBe(media.address);
      expect(OVERVIEW[id], `${id} 소개글`).toBe(media.overview);
    }
  });

  it("작게 유지된다 — 카드용은 소개글을 담지 않는다(첫 화면 JS 에 실리므로)", () => {
    expect(JSON.stringify(CARD).length).toBeLessThan(30_000);
    for (const entry of Object.values(CARD)) expect(Object.keys(entry).every((key) => key === "t" || key === "a")).toBe(true);
  });
});

describe("mediaCard", () => {
  it("아는 곳의 사진과 주소를 돌려주고, 모르는 곳은 비운다", () => {
    expect(getSpotThumbnail("경복궁")).toMatch(/^https:\/\//);
    expect(getSpotAddress("경복궁")).toContain("종로구");
    expect(getSpotThumbnail("없는-여행지")).toBeUndefined();
    expect(getSpotAddress("없는-여행지")).toBe("");
  });
});
