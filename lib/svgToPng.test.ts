// @vitest-environment node
import { describe, it, expect } from "vitest";
import { STORY, fitInStory } from "./svgToPng";

/*
  스토리(9:16) 바탕에 카드를 앉히는 자리.

  폭에만 맞추면 카드가 길어졌을 때 위아래가 잘린다. 카드 높이는 내용에
  따라 바뀌어 왔으므로(달 띠가 들어가며 1000 → 1060), 무엇을 바꾸든
  안 잘리는 쪽으로 못 박아 둔다.
*/
describe("fitInStory", () => {
  it("가운데에 앉힌다", () => {
    const box = fitInStory(720, 1060);
    expect(box.x + box.width / 2).toBeCloseTo(STORY.width / 2, 5);
    expect(box.y + box.height / 2).toBeCloseTo(STORY.height / 2, 5);
  });

  it("비율을 지킨다", () => {
    const box = fitInStory(720, 1060);
    expect(box.width / box.height).toBeCloseTo(720 / 1060, 5);
  });

  it("아무리 길어도 잘리지 않는다", () => {
    const box = fitInStory(720, 4000);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(STORY.height);
  });

  it("아무리 넓어도 잘리지 않는다", () => {
    const box = fitInStory(4000, 720);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(STORY.width);
  });

  it("가장자리에 숨 쉴 자리를 남긴다", () => {
    const box = fitInStory(720, 1060);
    expect(box.x).toBeGreaterThan(0);
    expect(box.width).toBeLessThan(STORY.width);
  });
});
