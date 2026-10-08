// @vitest-environment node
import { describe, it, expect } from "vitest";
import { CHAPTERS, DETAIL_MAX, SUMMARY_MAX } from "./help";

/*
  안내가 화면보다 앞서 나가면 사람은 없는 단추를 찾아 헤매고, 그때부터
  안내를 믿지 않는다. 글이 비어 있지 않은지만이라도 못 박는다.
*/
describe("도움말 내용", () => {
  it("갈래마다 제목·설명·갈 곳·단계가 있다", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.title.length).toBeGreaterThan(0);
      expect(chapter.blurb.length).toBeGreaterThan(0);
      expect(chapter.href.startsWith("/")).toBe(true);
      expect(chapter.steps.length).toBeGreaterThan(0);
      for (const step of chapter.steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("갈래 이름이 겹치지 않는다", () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /*
    글은 세 층이다 — 갈래의 요약(blurb), 항목의 제목+한 줄 요약(목록), 눌러야 펼쳐지는 상세설명.
    한 문단에 다 넣던 때는 항목 하나가 2천 자를 넘었다. 다시 그렇게 자라지 못하게 한도를 못 박는다.
  */
  describe("세 층 — 요약 · 목록 · 상세설명", () => {
    const steps = CHAPTERS.flatMap((chapter) => chapter.steps.map((step) => ({ chapter, step })));

    it("항목마다 한 줄 요약이 있고, 제목과도 설명과도 다르다", () => {
      for (const { step } of steps) {
        expect(step.summary.trim().length, step.title).toBeGreaterThan(0);
        expect(step.summary, step.title).not.toBe(step.title);
        expect(step.summary, step.title).not.toBe(step.detail);
      }
    });

    it(`한 줄 요약은 ${SUMMARY_MAX}자를 넘지 않는다 — 목록에서 훑어볼 수 있게`, () => {
      for (const { step } of steps) expect(step.summary.length, step.title).toBeLessThanOrEqual(SUMMARY_MAX);
    });

    it(`상세설명은 ${DETAIL_MAX}자를 넘지 않는다 — 길어지면 항목을 나눈다`, () => {
      for (const { step } of steps) expect(step.detail.length, step.title).toBeLessThanOrEqual(DETAIL_MAX);
    });

    it("갈래의 요약(blurb)은 한 줄이다", () => {
      for (const chapter of CHAPTERS) expect(chapter.blurb.length, chapter.title).toBeLessThanOrEqual(60);
    });

    it("항목 제목이 한 갈래 안에서 겹치지 않는다", () => {
      for (const chapter of CHAPTERS) {
        const titles = chapter.steps.map((step) => step.title);
        expect(new Set(titles).size, chapter.title).toBe(titles.length);
      }
    });
  });

  it("가족 책장은 계정과 보관에서 갈래를 따로 떼어 냈다 — 순서는 스케치·이번 여행·100선·가족 책장·계정", () => {
    expect(CHAPTERS.map((chapter) => chapter.id)).toEqual(["sketch", "trip", "browse", "shelf", "account"]);
    const shelf = CHAPTERS.find((chapter) => chapter.id === "shelf")!;
    expect(shelf.title).toBe("가족 책장");
    expect(shelf.href).toBe("/mailboxes");
  });

  it("내 정보에서 내 책장 속으로 들어가는 길을 알려 준다", () => {
    const shelf = CHAPTERS.find((chapter) => chapter.id === "shelf")!;
    const step = shelf.steps.find((s) => s.title === "내 책장 속으로 들어가 보기")!;
    expect(step).toBeTruthy();
    expect(step.detail).toContain("내 정보");
    expect(step.detail).toContain("책꽂이");
    expect(step.detail).toContain("부모님께 가지 않아요");
  });

  it("책꽂이의 단추가 해 제목 아래로 옮겨진 것을 말한다", () => {
    const shelf = CHAPTERS.find((chapter) => chapter.id === "shelf")!;
    const text = shelf.steps.map((step) => step.detail).join(" ");
    expect(text).toContain("해 제목 바로 아래 '올해의 책 보기'");
    expect(text).toContain("해 제목 바로 아래 '지도로 보기'");
    expect(text).not.toContain("다녀온 곳 지도로 보기");
  });
});
