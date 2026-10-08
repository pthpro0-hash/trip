import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { TripMoreMenu } from "./TripMoreMenu";

/*
  여행 상세의 단추 줄에는 링크 공유 · 엽서 보내기 · 이 여행 지우기가 같은 크기로 나란히 있었다. 지우기가 공유 바로
  옆이라 손이 미끄러질 자리이고, 되돌릴 수 없는 일이 평범한 일과 같은 무게로 보였다. 지우기는 "⋯" 안으로 들어간다 —
  누른 뒤에도 한 번 더 묻는 것은 그대로다.
*/

function menu(props: Partial<ComponentProps<typeof TripMoreMenu>> = {}) {
  const fns = { onAsk: vi.fn(), onConfirm: vi.fn(), onCancel: vi.fn() };
  const view = render(
    <TripMoreMenu
      confirming={false}
      removing={false}
      confirmText="정말 지울까요? 사진도 함께 사라져요"
      {...fns}
      {...props}
    />,
  );
  return { ...view, ...fns };
}

const trigger = () => screen.getByRole("button", { name: "더 보기" });
const open = () => fireEvent.click(trigger());

describe("TripMoreMenu", () => {
  it("처음에는 점 셋 단추 하나만 — 지우기는 보이지 않는다", () => {
    menu();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /이 여행 지우기/ })).toBeNull();
  });

  it("누르면 '이 여행 지우기'가 나온다", () => {
    menu();
    open();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "이 여행 지우기" })).toBeTruthy();
  });

  it("지우기를 누르면 곧바로 지우지 않고 묻기 시작한다", () => {
    const { onAsk, onConfirm } = menu();
    open();
    fireEvent.click(screen.getByRole("button", { name: "이 여행 지우기" }));
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("묻는 중에는 무엇이 함께 사라지는지 단추에 적고, 한 번 더 누르면 지운다", () => {
    const { onConfirm } = menu({ confirming: true, confirmText: "정말 지울까요? 사진과 보낸 엽서 2장이 함께 사라져요" });
    open();
    const sure = screen.getByRole("button", { name: "정말 지울까요? 사진과 보낸 엽서 2장이 함께 사라져요" });
    // 되돌릴 수 없는 일이라 평범한 단추와 다르게 보인다.
    expect(sure.className).toContain("bg-[#d70015]");
    fireEvent.click(sure);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("지우는 동안에는 누를 수 없다 — 두 번 지우지 않게", () => {
    menu({ confirming: true, removing: true });
    open();
    expect(screen.getByRole("button", { name: "지우는 중…" })).toBeDisabled();
  });

  it("손을 떼면(묻던 단추에서 벗어나면) 묻던 것을 거둔다 — 잘못 눌러도 지워지지 않게", () => {
    const { onCancel } = menu({ confirming: true });
    open();
    fireEvent.blur(screen.getByRole("button", { name: /정말 지울까요/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("묻는 중이 아닐 때 손을 떼는 것은 아무 일도 아니다", () => {
    const { onCancel } = menu({ confirming: false });
    open();
    fireEvent.blur(screen.getByRole("button", { name: "이 여행 지우기" }));
    expect(onCancel).not.toHaveBeenCalled();
  });

  describe("닫을 때는 묻던 것도 거둔다", () => {
    it("점 셋 단추를 다시 누르면", () => {
      const { onCancel } = menu({ confirming: true });
      open();
      open();
      expect(screen.queryByRole("button", { name: /정말 지울까요/ })).toBeNull();
      expect(onCancel).toHaveBeenCalled();
    });

    it("Esc 를 누르면", () => {
      const { onCancel } = menu({ confirming: true });
      open();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("button", { name: /정말 지울까요/ })).toBeNull();
      expect(onCancel).toHaveBeenCalled();
    });

    it("바깥을 누르면 — 안쪽을 누를 때는 닫지 않는다", () => {
      const { onCancel } = menu({ confirming: true });
      open();
      fireEvent.pointerDown(screen.getByRole("group", { name: "더 보기" }));
      expect(screen.getByRole("button", { name: /정말 지울까요/ })).toBeTruthy();
      expect(onCancel).not.toHaveBeenCalled();

      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole("button", { name: /정말 지울까요/ })).toBeNull();
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
