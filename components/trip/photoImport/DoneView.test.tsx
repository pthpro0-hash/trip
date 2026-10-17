import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MAP_HREF, SKETCH_HREF } from "@/lib/nav";
import { DoneView } from "./DoneView";
import type { SaveOutcome } from "./types";

/*
  기록이 끝난 뒤. 예전에는 목록 위에 작은 안내 상자가 떴고, 그 아래에는 방금 기록한 카드들이 그대로
  남아 있었다 — 끝난 것인지 아닌지 알기 어려웠다. 끝났다고 크게 말하고, 다음에 갈 곳 둘을 건넨다.
*/
const outcome = (partial: Partial<SaveOutcome> = {}): SaveOutcome => ({
  saved: 2,
  skipped: 0,
  failed: 0,
  photos: 0,
  photosFailed: 0,
  unsupported: [],
  overLimit: 0,
  merged: 0,
  duplicates: 0,
  ...partial,
});

function done(partial: Partial<SaveOutcome> = {}, onRetry?: () => void) {
  const onMore = vi.fn();
  const view = render(<DoneView outcome={outcome(partial)} onMore={onMore} onRetry={onRetry} />);
  return { ...view, onMore };
}

describe("DoneView", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  it("몇 건을 기록했는지 크게 말한다", () => {
    done({ saved: 2 });
    expect(screen.getByRole("heading", { name: "여행 2건을 기록했어요" })).toBeTruthy();
  });

  it("하나도 새로 기록하지 못했으면 그렇다고 말한다", () => {
    done({ saved: 0, skipped: 1 });
    expect(screen.getByRole("heading", { name: "새로 기록한 여행이 없어요" })).toBeTruthy();
  });

  it("다음에 갈 곳 둘 — 지도에서 보기, 한장 요약 보기", () => {
    done();
    expect(screen.getByRole("link", { name: "지도에서 보기" })).toHaveAttribute("href", MAP_HREF);
    expect(screen.getByRole("link", { name: "한장 요약 보기" })).toHaveAttribute("href", SKETCH_HREF);
  });

  it("사진을 더 고르는 길은 글 단추로 한쪽에 둔다", () => {
    const { onMore } = done();
    fireEvent.click(screen.getByRole("button", { name: "사진 더 고르기" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("올라간 사진 수를 알린다", () => {
    done({ photos: 18 });
    expect(screen.getByText("사진 18장을 함께 올렸어요")).toBeTruthy();
  });

  it("건너뛴 여행을 알린다 — 같은 사진을 두 번 넣었을 때", () => {
    done({ skipped: 1 });
    expect(screen.getByText("이미 있던 1건은 건너뛰었어요")).toBeTruthy();
  });

  it("브라우저가 열지 못해 올리지 못한 사진이 있어도 기록은 남았다고 말한다", () => {
    done({ unsupported: ["a.heic", "b.heic"] });
    expect(
      screen.getByText("2장은 이 브라우저가 열지 못하는 형식이라 올리지 못했어요. 기록 자체는 남아 있어요."),
    ).toBeTruthy();
  });

  it("보관할 수 있는 수를 넘은 사진을 알린다", () => {
    done({ overLimit: 5 });
    expect(screen.getByText("보관할 수 있는 사진 수를 넘어 5장은 올리지 못했어요")).toBeTruthy();
  });

  it("아무 일도 없었으면 덧붙이는 말이 없다", () => {
    const { container } = done();
    expect(container.querySelector("ul")).toBeNull();
  });

  describe("저장하지 못한 여행이 있을 때", () => {
    it("몇 건인지 알리고, 다시 기록해 볼 수 있게 한다", () => {
      const onRetry = vi.fn();
      done({ saved: 1, failed: 1 }, onRetry);
      expect(screen.getByText("1건은 저장하지 못했어요")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "다시 기록해 보기" }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("실패가 없으면 다시 기록하라고 하지 않는다", () => {
      done({ saved: 2 }, vi.fn());
      expect(screen.queryByRole("button", { name: "다시 기록해 보기" })).toBeNull();
    });
  });

  describe("사진 올리기만 막혔을 때", () => {
    it("몇 장인지 알리고, 그 사진만 다시 올릴 수 있게 한다", () => {
      const onRetryPhotos = vi.fn();
      render(<DoneView outcome={outcome({ photos: 3, photosFailed: 2 })} onMore={vi.fn()} onRetryPhotos={onRetryPhotos} />);
      expect(screen.getByText(/사진 2장은 올리지 못했어요. 여행 기록은 남아 있어요/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "올리지 못한 사진 2장 다시 올리기" }));
      expect(onRetryPhotos).toHaveBeenCalledTimes(1);
    });

    it("다시 올리는 동안은 단추를 잠그고 진행을 보인다", () => {
      render(<DoneView outcome={outcome({ photosFailed: 2 })} onMore={vi.fn()} onRetryPhotos={vi.fn()} retrying progress="1장 / 2장" />);
      expect(screen.getByRole("button", { name: "사진을 올리고 있어요…" })).toBeDisabled();
      expect(screen.getByRole("status").textContent).toContain("1장 / 2장");
    });

    it("막힌 사진이 없으면 다시 올리라고 하지 않는다", () => {
      render(<DoneView outcome={outcome({ photos: 3 })} onMore={vi.fn()} onRetryPhotos={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /다시 올리기/ })).toBeNull();
    });
  });

  describe("올리지 못한 사진이 있는데 사진을 더 고르려 할 때", () => {
    const 더고르기 = () => screen.getByRole("button", { name: "사진 더 고르기" });

    it("한 번 묻는다 — 더 고르면 그 사진은 다시 올릴 수 없다", () => {
      const onMore = vi.fn();
      render(<DoneView outcome={outcome({ photos: 3, photosFailed: 2 })} onMore={onMore} onRetryPhotos={vi.fn()} />);
      fireEvent.click(더고르기());

      expect(onMore).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      expect(screen.getByText(/올리지 못한 사진 2장이 있어요. 지금 사진을 더 고르면 그 사진은 다시 올릴 수 없어요/)).toBeTruthy();
      // 묻는 동안은 초점이 안전한 쪽(돌아가기)에 있다.
      expect(screen.getByRole("button", { name: "돌아가기" })).toHaveFocus();
    });

    it("[그래도 더 고르기]를 눌러야 고른다", () => {
      const onMore = vi.fn();
      render(<DoneView outcome={outcome({ photosFailed: 1 })} onMore={onMore} onRetryPhotos={vi.fn()} />);
      fireEvent.click(더고르기());
      fireEvent.click(screen.getByRole("button", { name: "그래도 더 고르기" }));
      expect(onMore).toHaveBeenCalledTimes(1);
    });

    it("[돌아가기]를 누르면 묻는 창을 닫고 아무것도 바뀌지 않는다 — 다시 올리기도 그대로 있다", () => {
      const onMore = vi.fn();
      render(<DoneView outcome={outcome({ photosFailed: 1 })} onMore={onMore} onRetryPhotos={vi.fn()} />);
      fireEvent.click(더고르기());
      fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(onMore).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "올리지 못한 사진 1장 다시 올리기" })).toBeTruthy();
    });

    it("잃을 사진이 없으면 묻지 않고 곧바로 고른다", () => {
      const onMore = vi.fn();
      render(<DoneView outcome={outcome({ photos: 3 })} onMore={onMore} />);
      fireEvent.click(더고르기());
      expect(onMore).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });

    it("묻는 중에 사진을 다 올렸으면 창이 저절로 사라진다", () => {
      const view = render(<DoneView outcome={outcome({ photosFailed: 1 })} onMore={vi.fn()} onRetryPhotos={vi.fn()} />);
      fireEvent.click(더고르기());
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      view.rerender(<DoneView outcome={outcome({ photos: 1, photosFailed: 0 })} onMore={vi.fn()} onRetryPhotos={vi.fn()} />);
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  describe("보이는 자리", () => {
    it("맨 위로 올려 보여 준다 — 긴 목록 아래에서 눌렀어도", () => {
      done();
      expect(window.scrollTo).toHaveBeenCalled();
    });

    it("제목에 초점을 두어, 화면 읽기 도구가 결과부터 읽는다", () => {
      done();
      expect(screen.getByRole("heading", { name: "여행 2건을 기록했어요" })).toHaveFocus();
    });
  });
});
