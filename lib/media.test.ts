// @vitest-environment node
// Pure data checks — no DOM needed, and jsdom startup dominates this suite's
// runtime on this machine.
import { describe, it, expect } from "vitest";
import mediaData from "./data/spot-media.json";
import spotsData from "./data/spots.json";
import { getSpotMedia, getSpotThumbnail } from "./media";
import type { Spot, SpotMedia } from "./types";

const MEDIA = mediaData as Record<string, SpotMedia>;
const SPOTS = spotsData as Spot[];

describe("spot-media.json", () => {
  it("모든 키가 실제 여행지 id와 대응된다", () => {
    const ids = new Set(SPOTS.map((s) => s.id));
    for (const id of Object.keys(MEDIA)) {
      expect(ids.has(id), `${id}는 spots.json에 없는 id`).toBe(true);
    }
  });

  it("사진 URL이 전부 https다 (http면 브라우저가 혼합 콘텐츠로 차단한다)", () => {
    for (const [id, media] of Object.entries(MEDIA)) {
      for (const image of media.images) {
        expect(image.url.startsWith("https://"), `${id}: ${image.url}`).toBe(true);
      }
    }
  });

  it("사용 가능한 저작권 유형만 담는다", () => {
    for (const [id, media] of Object.entries(MEDIA)) {
      for (const image of media.images) {
        expect(["Type1", "Type3"], `${id}`).toContain(image.copyright);
      }
    }
  });

  it("소개글에 HTML 태그가 남아 있지 않다", () => {
    for (const [id, media] of Object.entries(MEDIA)) {
      expect(media.overview, `${id}`).not.toMatch(/<[a-z/][^>]*>/i);
    }
  });

  it("사진은 여행지당 최대 6장이다", () => {
    for (const media of Object.values(MEDIA)) {
      expect(media.images.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("getSpotMedia / getSpotThumbnail", () => {
  it("아는 여행지의 사진과 소개글을 돌려준다", () => {
    const media = getSpotMedia("경복궁");
    expect(media?.overview.length).toBeGreaterThan(100);
    expect(getSpotThumbnail("경복궁")).toMatch(/^https:\/\//);
  });

  it("모르는 id에는 undefined를 돌려준다", () => {
    expect(getSpotMedia("없는-여행지")).toBeUndefined();
    expect(getSpotThumbnail("없는-여행지")).toBeUndefined();
  });
});
