import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpDialog } from "./HelpDialog";
import { FirstVisitHelp } from "./FirstVisitHelp";
import { CHAPTERS, CORE_CHAPTERS, DETAIL_MAX, SUMMARY_MAX } from "@/lib/help";

/*
  처음 온 사람에게 이 서비스가 무엇을 해 주는지 한 번은 말해 준다.
  단, 한 번만 — 올 때마다 뜨면 안내가 아니라 방해다.
*/
describe("HelpDialog", () => {
  it("핵심부터 연다 — 여행 스케치", () => {
    render(<HelpDialog onClose={() => {}} />);
    expect(CORE_CHAPTERS[0].title).toBe("여행 스케치");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/여행 스케치/)).toBeTruthy();
  });

  it("한 번에 한 갈래씩 넘긴다", () => {
    render(<HelpDialog onClose={() => {}} />);
    expect(screen.getByText("1 / 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /다음: 이번 여행/ }));

    expect(screen.getByText("2 / 2")).toBeTruthy();
    expect(screen.getByText("가고 싶은 곳에 담으세요")).toBeTruthy();
  });

  /*
    팝업은 훑고 지나가는 곳이다. 항목마다 긴 설명이 다 펼쳐져 있으면 글이 많아 보여서 읽기 전에 닫는다.
    제목과 한 줄 요약만 보이고, 자세한 설명은 도움말 전체에서 읽는다.
  */
  it("항목은 제목과 한 줄 요약만 보인다 — 긴 설명은 도움말 전체에서", () => {
    render(<HelpDialog onClose={() => {}} />);
    const first = CORE_CHAPTERS[0].steps[0];
    expect(screen.getByText(first.title)).toBeTruthy();
    expect(screen.getByText(first.summary)).toBeTruthy();
    expect(screen.queryByText(first.detail)).toBeNull();
  });

  it("갈래의 요약(한 줄)도 보인다", () => {
    render(<HelpDialog onClose={() => {}} />);
    expect(screen.getByText(CORE_CHAPTERS[0].blurb)).toBeTruthy();
  });

  it("도움말 전체로 가는 길을 둔다", () => {
    render(<HelpDialog onClose={() => {}} />);
    expect(screen.getByRole("link", { name: /도움말 전체 보기/ })).toHaveAttribute("href", "/help");
  });

  it("Escape 로 닫힌다", () => {
    const onClose = vi.fn();
    render(<HelpDialog onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("바깥을 누르면 닫히고 안쪽을 눌러서는 닫히지 않는다", () => {
    const onClose = vi.fn();
    render(<HelpDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("FirstVisitHelp", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("처음 온 사람에게는 뜬다", () => {
    render(<FirstVisitHelp />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("한 번 닫으면 다시 뜨지 않는다", () => {
    const first = render(<FirstVisitHelp />);
    fireEvent.click(screen.getByRole("button", { name: "안내 닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    // 다음에 다시 왔을 때.
    render(<FirstVisitHelp />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("저장소가 막혀 있어도 터지지 않는다", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("막힘");
      },
      configurable: true,
    });

    expect(() => render(<FirstVisitHelp />)).not.toThrow();

    if (original) Object.defineProperty(window, "localStorage", original);
  });
});

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
