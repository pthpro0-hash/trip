import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HelpDialog } from "./HelpDialog";
import { FirstVisitHelp } from "./FirstVisitHelp";
import { CHAPTERS, CORE_CHAPTERS } from "@/lib/help";

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
});
