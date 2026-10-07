import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MailboxSettingsEditor } from "./MailboxSettingsEditor";
import { RECOMMENDED, type MailboxSettings } from "@/lib/mailboxSettings";

const open = (initial: MailboxSettings = RECOMMENDED, extra: Partial<React.ComponentProps<typeof MailboxSettingsEditor>> = {}) => {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(<MailboxSettingsEditor initial={initial} busy={false} onSave={onSave} onCancel={onCancel} {...extra} />);
  return { onSave, onCancel };
};

describe("MailboxSettingsEditor · 책장 설정", () => {
  it("처음에는 모두 권장 — '권장' 표시가 각 묶음에 붙고, 안내도 그렇게 말한다", () => {
    open();
    expect(screen.getByText("지금 모두 권장 설정이에요")).toBeTruthy();
    expect(screen.getAllByText("권장").length).toBeGreaterThanOrEqual(6);
    expect(screen.getByRole("radio", { name: /20장/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /보통/, checked: true })).toBeTruthy();
  });

  it("책 한 권 사진 수를 6·12·20장에서 고른다", () => {
    const { onSave } = open();
    fireEvent.click(screen.getByRole("radio", { name: /12장/ }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ photos: 12 }));
  });

  it("사진 크기를 고르면 용량 어림이 바뀐다", () => {
    open();
    expect(screen.getByText(/책 한 권이 약 1\.0~1\.4MB/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /선명/ }));
    expect(screen.getByText(/책 한 권이 약 2\.0~2\.8MB/)).toBeTruthy();
  });

  it("글씨 크기를 바꾸면 미리보기 글씨가 따라 바뀐다", () => {
    open();
    const preview = screen.getByTestId("font-preview");
    expect(preview).toHaveStyle({ fontSize: "22px" });
    fireEvent.click(screen.getByRole("radio", { name: "아주 크게" }));
    expect(preview).toHaveStyle({ fontSize: "26.4px" });
    fireEvent.click(screen.getByRole("radio", { name: "보통" }));
    expect(preview).toHaveStyle({ fontSize: "18.7px" });
  });

  it("답장 문구를 바꿔 저장한다 — 15자까지", () => {
    const { onSave } = open();
    fireEvent.change(screen.getByLabelText("답장 문구 1"), { target: { value: "고맙다" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].words).toEqual(["고맙다", "잘 다녀왔니", "다음엔 같이 가자"]);
    expect(screen.getByLabelText("답장 문구 1")).toHaveAttribute("maxlength", "15");
  });

  it("문구를 비우면 권장 문구로 저장된다", () => {
    const { onSave } = open();
    fireEvent.change(screen.getByLabelText("답장 문구 2"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0].words[1]).toBe("잘 다녀왔니");
  });

  it("권장과 다른 설정의 수를 알리고, 바꾼 칸의 권장 표시는 사라진다", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: /6장/ }));
    fireEvent.click(screen.getByRole("radio", { name: "아주 크게" }));
    expect(screen.getByText("권장과 다른 설정 2개")).toBeTruthy();
  });

  it("[권장으로 되돌리기]는 모든 칸을 권장으로 — 저장은 따로 눌러야 한다", () => {
    const { onSave } = open({ ...RECOMMENDED, photos: 6, size: 960, font: "xlarge", heart: "book", words: ["하나", "둘", "셋"] });
    expect(screen.getByText("권장과 다른 설정 5개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "권장으로 되돌리기" }));
    expect(screen.getByText("지금 모두 권장 설정이에요")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(RECOMMENDED);
  });

  it("하트를 사진마다(권장) 받을지 책마다 받을지 고른다", () => {
    const { onSave } = open();
    expect(screen.getByRole("radio", { name: /사진마다/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /책마다/ }));
    expect(screen.getByText("권장과 다른 설정 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ heart: "book" }));
  });

  it("작년 오늘을 보여 줄지(권장) 고른다", () => {
    const { onSave } = open();
    expect(screen.getByRole("radio", { name: "보여 주기" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "안 보여 주기" }));
    expect(screen.getByText("권장과 다른 설정 1개")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ past: false }));
  });

  it("끈 작년 오늘이 저장된 설정을 열면 '안 보여 주기'로 보인다", () => {
    open({ ...RECOMMENDED, past: false });
    expect(screen.getByRole("radio", { name: "안 보여 주기" })).toBeChecked();
    expect(screen.getByText("권장과 다른 설정 1개")).toBeTruthy();
  });

  it("아직 기능이 없는 설정(보관 권수·올해의 책)은 화면에 내지 않지만 저장할 때 값은 지킨다", () => {
    const stored: MailboxSettings = { ...RECOMMENDED, keep: "all", year: false };
    const { onSave } = open(stored);
    for (const word of ["보관 권수", "올해의 책"]) expect(screen.queryByText(new RegExp(word))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ keep: "all", year: false }));
  });

  it("그만두기는 저장하지 않고 닫는다", () => {
    const { onSave, onCancel } = open();
    fireEvent.click(screen.getByRole("button", { name: "그만두기" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("바꾼 것이 어디에 적용되는지 말해 준다 — 새 책부터 / 바로", () => {
    open();
    expect(screen.getByText(/새로 꽂는 책부터 적용돼요/)).toBeTruthy();
    expect(screen.getByText(/부모님 화면에는 바로 적용돼요/)).toBeTruthy();
  });
});
