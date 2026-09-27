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
