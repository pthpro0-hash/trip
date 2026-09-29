import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareSpotButton } from "./ShareSpotButton";

/*
  주소를 건네는 일뿐이다. 무엇을 건네는지(대표 주소인지), 공유 창이 없을 때
  복사로 물러나는지를 못 박는다.
*/

const props = { spotId: "경복궁", spotName: "경복궁", summary: "조선의 법궁" };

function press() {
  render(<ShareSpotButton {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "경복궁 링크 공유" }));
}

describe("ShareSpotButton", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/spots/%EA%B2%BD%EB%B3%B5%EA%B6%81?from=browse&q=%EA%B6%81");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });

  it("공유 창이 있으면 그 곳의 대표 주소를 건넨다 — 검색·필터 조각은 떼고", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    press();

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share).toHaveBeenCalledWith({
      title: "경복궁",
      text: "조선의 법궁",
      url: `${window.location.origin}/spots/${encodeURIComponent("경복궁")}`,
    });
  });

  it("공유 창이 없으면 주소를 복사하고 알린다", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    press();

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/spots/${encodeURIComponent("경복궁")}`));
    expect(await screen.findByText("주소를 복사했어요")).toBeTruthy();
  });

  it("복사도 안 되면 그렇다고 말한다", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    press();

    expect(await screen.findByText(/복사하지 못했어요/)).toBeTruthy();
  });

  it("공유 창을 닫아도(취소) 오류로 알리지 않는다", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    press();

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByText(/복사하지 못했어요/)).toBeNull();
  });
});
