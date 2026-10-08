import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DismissedTrip, TripCard } from "./TripCard";
import type { VisitLine } from "./types";

// 작은 그림 칸은 따로 시험한다. 여기서는 몇 장을 받았는지만 본다.
vi.mock("./TripThumbs", () => ({
  TripThumbs: ({ files }: { files: File[] }) => <div data-testid="thumbs" data-count={files.length} />,
}));

/*
  사진을 고른 뒤 가장 먼저 하는 일은 "이게 내 어느 여행이지?" 알아보는 것이다. 카드는 그것을 먼저 보여 주고
  (제목 · 기간 · 작은 그림), 곳 목록 · 동행 · 나누기 · 합치기는 "다듬기" 안으로 접는다 — 대부분의 사람은
  그것을 건드리지 않고 지나간다.
*/
const visit = (partial: Partial<VisitLine> = {}): VisitLine => ({
  id: 0,
  title: "화진포해변",
  curated: false,
  when: "09-13 09:21~09:27 · 2장",
  ...partial,
});

const 두곳: VisitLine[] = [
  visit({ id: 0 }),
  visit({ id: 1, title: "안목해변", when: "09-14 06:11~08:41 · 2장", cut: { day: "2026-09-14", km: 90.4 } }),
];

function card(partial: Partial<ComponentProps<typeof TripCard>> = {}) {
  const fns = {
    onTitle: vi.fn(),
    onCompanions: vi.fn(),
    onMergeUp: vi.fn(),
    onSplit: vi.fn(),
    onDismiss: vi.fn(),
  };
  const view = render(
    <TripCard
      title="화진포해변 외 1곳"
      span="2026년 9월 13일 ~ 14일"
      photos={4}
      places={2}
      files={[]}
      visits={두곳}
      companions=""
      editable
      alreadySaved={false}
      canMergeUp={false}
      {...fns}
      {...partial}
    />,
  );
  return { ...view, ...fns };
}

const toggle = () => screen.getByRole("button", { name: /다듬기|방문한 곳 보기/ });

describe("TripCard · 겉모습", () => {
  it("제목은 바로 고칠 수 있는 칸이다", () => {
    const { onTitle } = card();
    const input = screen.getByLabelText("여행 제목") as HTMLInputElement;
    expect(input.value).toBe("화진포해변 외 1곳");
    fireEvent.change(input, { target: { value: "민수랑 첫 휴가" } });
    expect(onTitle).toHaveBeenCalledWith("민수랑 첫 휴가");
  });

  it("고칠 수 있다는 것이 보인다 — 연필 표시", () => {
    const { container } = card();
    expect(container.querySelector('[data-icon="pencil"]')).not.toBeNull();
  });

  it("고칠 수 없으면(이미 기록했거나 로그인 전) 글자로만 보인다", () => {
    const { container } = card({ editable: false });
    expect(screen.queryByLabelText("여행 제목")).toBeNull();
    expect(screen.getByText("화진포해변 외 1곳")).toBeTruthy();
    expect(container.querySelector('[data-icon="pencil"]')).toBeNull();
  });

  it("제목이 비어 있으면 고칠 수 없는 카드는 기간을 제목 자리에 쓴다", () => {
    card({ editable: false, title: "" });
    expect(screen.getAllByText("2026년 9월 13일 ~ 14일").length).toBeGreaterThan(0);
  });

  it("기간 · 사진 수 · 방문한 곳 수를 한 줄로 적는다", () => {
    card();
    expect(screen.getByText("2026년 9월 13일 ~ 14일 · 사진 4장 · 방문 2곳")).toBeTruthy();
  });

  it("'여행 아님' 단추로 뺀다", () => {
    const { onDismiss } = card();
    fireEvent.click(screen.getByRole("button", { name: "여행 아님" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("이미 기록한 날짜와 겹치면 접혀 있어도 알린다", () => {
    card({ alreadySaved: true, editable: false });
    expect(screen.getByText("이미 기록한 날짜와 겹쳐요.")).toBeTruthy();
  });

  it("겹치지 않으면 그 말이 없다", () => {
    card();
    expect(screen.queryByText("이미 기록한 날짜와 겹쳐요.")).toBeNull();
  });

  it("작은 그림으로 쓸 사진을 건넨다", () => {
    const files = [new File(["x"], "a.jpg"), new File(["x"], "b.jpg"), new File(["x"], "c.jpg")];
    card({ files });
    expect(screen.getByTestId("thumbs")).toHaveAttribute("data-count", "3");
  });

  it("건넬 사진이 없으면 그림 자리를 두지 않는다", () => {
    card({ files: [] });
    expect(screen.queryByTestId("thumbs")).toBeNull();
  });
});

describe("TripCard · 다듬기", () => {
  it("처음에는 접혀 있다 — 곳 목록도 동행 칸도 보이지 않는다", () => {
    card();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("안목해변")).toBeNull();
    expect(screen.queryByLabelText("누구와 가셨나요?")).toBeNull();
  });

  it("누르면 펼쳐지고 다시 누르면 접힌다", () => {
    card();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("안목해변")).toBeTruthy();
    fireEvent.click(toggle());
    expect(screen.queryByText("안목해변")).toBeNull();
  });

  it("들른 곳을 순서대로 늘어놓는다 — 100선이면 표시한다", () => {
    card({ visits: [visit({ id: 0, title: "경포대", curated: true }), visit({ id: 1, title: "안목해변" })] });
    fireEvent.click(toggle());
    expect(screen.getByText("경포대")).toBeTruthy();
    expect(screen.getByText("100선")).toBeTruthy();
    expect(screen.getAllByText("09-13 09:21~09:27 · 2장").length).toBeGreaterThan(0);
  });

  it("함께 간 사람을 적을 수 있다", () => {
    const { onCompanions } = card({ companions: "가족" });
    fireEvent.click(toggle());
    const input = screen.getByLabelText("누구와 가셨나요?") as HTMLInputElement;
    expect(input.value).toBe("가족");
    fireEvent.change(input, { target: { value: "민수" } });
    expect(onCompanions).toHaveBeenCalledWith("민수");
  });

  it("멀리 떨어진 자리에서 따로 기록하기를 묻는다", () => {
    const { onSplit } = card();
    fireEvent.click(toggle());
    expect(screen.getByText(/여기서 날이 바뀌고 90km 떨어져요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "따로 기록하기" }));
    expect(onSplit).toHaveBeenCalledWith("2026-09-14");
  });

  it("나눌 자리가 없으면 묻지 않는다", () => {
    card({ visits: [visit({ id: 0 }), visit({ id: 1, title: "송정해변" })] });
    fireEvent.click(toggle());
    expect(screen.queryByRole("button", { name: "따로 기록하기" })).toBeNull();
  });

  it("위 여행과 합칠 수 있으면 그 단추가 안에 있다", () => {
    const { onMergeUp } = card({ canMergeUp: true });
    expect(screen.queryByRole("button", { name: /한 여행이었어요/ })).toBeNull();
    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: /위 여행과 한 여행이었어요/ }));
    expect(onMergeUp).toHaveBeenCalledTimes(1);
  });

  it("합칠 수 없으면 그 단추가 없다", () => {
    card({ canMergeUp: false });
    fireEvent.click(toggle());
    expect(screen.queryByRole("button", { name: /한 여행이었어요/ })).toBeNull();
  });

  describe("제안 표시", () => {
    it("나눌 자리와 합칠 수 있음을 합쳐 접힌 단추에 알린다 — 열어 볼 까닭이 된다", () => {
      card({ canMergeUp: true });
      expect(toggle()).toHaveTextContent("제안 2");
    });

    it("나눌 자리만 있으면 하나", () => {
      card();
      expect(toggle()).toHaveTextContent("제안 1");
    });

    it("제안이 없으면 표시도 없다", () => {
      card({ visits: [visit({ id: 0 })] });
      expect(toggle()).not.toHaveTextContent("제안");
    });
  });

  describe("고칠 수 없는 카드", () => {
    it("곳 목록은 볼 수 있지만 다듬는 일은 없다", () => {
      card({ editable: false, alreadySaved: true, canMergeUp: true });
      expect(toggle()).toHaveTextContent("방문한 곳 보기");
      expect(toggle()).not.toHaveTextContent("제안");
      fireEvent.click(toggle());
      expect(screen.getByText("안목해변")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "따로 기록하기" })).toBeNull();
      expect(screen.queryByRole("button", { name: /한 여행이었어요/ })).toBeNull();
      expect(screen.queryByLabelText("누구와 가셨나요?")).toBeNull();
    });
  });
});

describe("DismissedTrip · 뺀 여행", () => {
  it("무엇을 뺐는지 말하고 되돌릴 길을 둔다", () => {
    const onUndo = vi.fn();
    render(<DismissedTrip title="화진포해변 외 1곳" onUndo={onUndo} />);
    expect(screen.getByText(/‘화진포해변 외 1곳’을 뺐어요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
