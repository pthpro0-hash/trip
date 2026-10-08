import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ShareChooser } from "./ShareChooser";

/*
  여행 상세의 공유는 "링크 공유"와 "엽서 보내기" 두 단추였다. 이름만 봐서는 무엇이 누구에게 가는지 알기 어렵다. 단추를
  "공유" 하나로 합치고, 누르면 아래에서 올라오는 시트에서 고른다 — 각각 누구에게 어떻게 가는지를 한 줄씩 적어서.
  고른 뒤 열리는 창은 그대로다(링크 창, 엽서 창).
*/

function chooser() {
  const onLink = vi.fn();
  const onPostcard = vi.fn();
  const onClose = vi.fn();
  render(<ShareChooser title="강릉 1박 2일" onLink={onLink} onPostcard={onPostcard} onClose={onClose} />);
  return { onLink, onPostcard, onClose };
}

describe("ShareChooser", () => {
  it("어느 여행을 공유하는지 제목에 적는다", () => {
    chooser();
    expect(screen.getByRole("dialog", { name: "강릉 1박 2일 공유하기" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "강릉 1박 2일 공유하기" })).toBeTruthy();
  });

  it("고를 것은 둘 — 링크로 보여 주기, 부모님께 엽서 보내기", () => {
    chooser();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /링크로 보여 주기/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /부모님께 엽서 보내기/ })).toBeTruthy();
  });

  it("각각 누구에게 어떻게 가는지 한 줄로 알린다", () => {
    chooser();
    expect(screen.getByText("링크를 아는 사람은 이 여행 하나를 사진까지 볼 수 있어요")).toBeTruthy();
    expect(screen.getByText("부모님 책장에 사진과 한 줄이 엽서로 도착해요")).toBeTruthy();
  });

  it("엽서에 실리는 사진 수를 못 박아 말하지 않는다 — 고르는 창이 정한다", () => {
    chooser();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/\d+장/);
  });

  it("링크로 보여 주기를 고르면 그것만 알린다", () => {
    const { onLink, onPostcard } = chooser();
    fireEvent.click(screen.getByRole("button", { name: /링크로 보여 주기/ }));
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onPostcard).not.toHaveBeenCalled();
  });

  it("엽서를 고르면 그것만 알린다", () => {
    const { onLink, onPostcard } = chooser();
    fireEvent.click(screen.getByRole("button", { name: /부모님께 엽서 보내기/ }));
    expect(onPostcard).toHaveBeenCalledTimes(1);
    expect(onLink).not.toHaveBeenCalled();
  });

  it("닫기 단추와 Esc 로 닫는다", () => {
    const { onClose } = chooser();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
