import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HubDialog } from "./HubDialog";

/*
  지도에서 누른 것은 창으로 뜬다. 닫는 길이 여럿이어야 한다 — 창이
  화면을 거의 다 덮기 때문에, 닫는 법을 못 찾으면 갇힌 느낌이 든다.
*/
describe("HubDialog", () => {
  it("닫기 단추로 닫힌다", () => {
    const onClose = vi.fn();
    render(<HubDialog label="안목해변" onClose={onClose}>사진들</HubDialog>);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("바깥을 누르면 닫히고, 안쪽을 눌러서는 닫히지 않는다", () => {
    const onClose = vi.fn();
    render(<HubDialog label="안목해변" onClose={onClose}>사진들</HubDialog>);
    fireEvent.click(screen.getByText("사진들"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc 로 닫힌다", () => {
    const onClose = vi.fn();
    render(<HubDialog label="안목해변" onClose={onClose}>사진들</HubDialog>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  /*
    엽서를 만드는 동안처럼 일이 진행 중일 때 창을 닫아 버리면 그 일의 결과(링크)를 받을 길이 없다. 그동안은 Esc 와 바깥 누르기를
    무시한다(그 창을 덮는 대기 화면이 눌러서 닫는 길은 이미 막고 있다).
  */
  it("locked 인 동안에는 Esc·바깥 누르기·닫기 단추로 닫히지 않고, 풀리면 다시 닫힌다", () => {
    const onClose = vi.fn();
    const { rerender } = render(<HubDialog label="엽서 보내기" onClose={onClose} locked>사진들</HubDialog>);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(screen.getByRole("button", { name: "닫기" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    rerender(<HubDialog label="엽서 보내기" onClose={onClose}>사진들</HubDialog>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "닫기" })).toBeEnabled();
  });

  it("스크롤 창은 아래에 여백을 두고 굴러간다 — 아래에 붙은 띠가 초점 받은 칸을 가리지 않게", () => {
    render(<HubDialog label="엽서 보내기" onClose={() => {}}>사진들</HubDialog>);
    // 글자 하나뿐인 children 이면 그 글을 품은 요소가 곧 굴러가는 창이다.
    expect(screen.getByText("사진들").className).toContain("scroll-pb-32");
  });

  it("떠 있는 동안 뒤의 페이지가 굴러가지 않고, 닫으면 되돌린다", () => {
    const { unmount } = render(<HubDialog label="안목해변" onClose={() => {}}>사진들</HubDialog>);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("사진을 크게 보는 창(z-50)이 이 위로 뜬다", () => {
    render(<HubDialog label="안목해변" onClose={() => {}}>사진들</HubDialog>);
    expect(screen.getByRole("dialog").parentElement!.className).toContain("z-40");
  });
});
