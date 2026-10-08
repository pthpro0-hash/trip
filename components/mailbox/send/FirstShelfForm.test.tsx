import { describe, it, expect, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { FirstShelfForm } from "./FirstShelfForm";

/*
  처음 엽서를 보내는 사람에게는 책장이 없다. "책장을 만들어 주세요"라며 다른 화면(다섯 칸짜리 폼)으로 보내는 대신,
  엽서 창 안에서 두 가지만 묻는다 — 누구에게 보내나요, 말투는.
*/

function form(props: Partial<ComponentProps<typeof FirstShelfForm>> = {}) {
  const onSubmit = vi.fn();
  const view = render(<FirstShelfForm busy={false} error={null} onSubmit={onSubmit} {...props} />);
  return { ...view, onSubmit };
}

const who = () => screen.getByLabelText("누구에게 보내나요?") as HTMLInputElement;

describe("FirstShelfForm", () => {
  it("한 번만 하면 된다고 말하고, 두 가지만 묻는다", () => {
    form();
    expect(screen.getByRole("heading", { name: "부모님께 엽서 보내기" })).toBeTruthy();
    expect(screen.getByText("먼저 받는 분을 알려 주세요. 한 번만 하면 돼요.")).toBeTruthy();
    expect(who()).toBeTruthy();
    // 묶음 이름은 fieldset 의 legend 하나가 맡는다(안쪽 radiogroup 에 같은 이름을 또 달지 않는다).
    expect(screen.getByRole("group", { name: "말투" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    // 책장 이름 · 부르는 말 같은 칸은 묻지 않는다.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });

  it("예를 보여 준다", () => {
    form();
    expect(who().placeholder).toBe("엄마, 아빠");
  });

  it("말투는 편하게가 먼저 골라져 있다", () => {
    form();
    expect(screen.getByRole("radio", { name: "편하게" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "존댓말" })).not.toBeChecked();
  });

  it("적은 이름을 어떻게 알아들었는지 보여 준다 — 쉼표로 나눈 이름마다", () => {
    form();
    fireEvent.change(who(), { target: { value: "엄마, 아빠" } });
    const names = screen.getByLabelText("받는 분 미리보기");
    expect(within(names).getByText("엄마")).toBeTruthy();
    expect(within(names).getByText("아빠")).toBeTruthy();
  });

  it("적기 전에는 알아들은 이름 표시가 없다", () => {
    form();
    expect(screen.queryByLabelText("받는 분 미리보기")).toBeNull();
  });

  it("다음을 누르면 적은 그대로 건넨다", () => {
    const { onSubmit } = form();
    fireEvent.change(who(), { target: { value: "엄마, 아빠" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onSubmit).toHaveBeenCalledWith({ who: "엄마, 아빠", tone: "casual" });
  });

  it("존댓말을 고르면 그렇게 건넨다", () => {
    const { onSubmit } = form();
    fireEvent.change(who(), { target: { value: "장인 장모님" } });
    fireEvent.click(screen.getByRole("radio", { name: "존댓말" }));
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(onSubmit).toHaveBeenCalledWith({ who: "장인 장모님", tone: "polite" });
  });

  it("칸에서 Enter 를 눌러도 된다", () => {
    const { onSubmit } = form();
    fireEvent.change(who(), { target: { value: "할머니" } });
    fireEvent.submit(who().closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith({ who: "할머니", tone: "casual" });
  });

  it("비어 있으면 건네지 않고, 눌렀을 때 무엇이 빠졌는지 말로 알려 준다 — 단추를 흐리게 막지 않는다", () => {
    const { onSubmit } = form();
    const next = screen.getByRole("button", { name: "다음" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(screen.getByRole("alert")).toHaveTextContent("받는 분을 적어 주세요");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("쉼표뿐인 답도 비어 있는 것으로 본다", () => {
    const { onSubmit } = form();
    fireEvent.change(who(), { target: { value: " , · " } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("다시 적기 시작하면 빠졌다는 말이 사라진다", () => {
    form();
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(who(), { target: { value: "엄마" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("만드는 동안에는 누를 수 없다 — 책장이 둘 만들어지지 않게", () => {
    form({ busy: true });
    expect(screen.getByRole("button", { name: "만드는 중…" })).toBeDisabled();
  });

  it("만들지 못한 까닭을 알려 준다", () => {
    form({ error: "만들지 못했어요. 잠시 뒤 다시 해 주세요." });
    expect(screen.getByRole("alert")).toHaveTextContent("만들지 못했어요. 잠시 뒤 다시 해 주세요.");
  });

  it("나머지 설정은 나중에 바꿀 수 있다고 안심시킨다", () => {
    form();
    expect(screen.getByText(/나머지 설정은 나중에/)).toBeTruthy();
  });
});
