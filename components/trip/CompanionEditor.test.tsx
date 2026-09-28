import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompanionEditor } from "./CompanionEditor";

/*
  가져올 때 비워 둔 동행자를 나중에 채운다. 대부분 늘 같은 사람과
  다니므로, 전에 적은 이름을 한 번 누르면 끝나야 한다.
*/
describe("CompanionEditor", () => {
  it("비어 있으면 적기를 내민다", () => {
    render(<CompanionEditor value={null} suggestions={[]} onSave={async () => true} />);
    expect(screen.getByRole("button", { name: "+ 누구와 갔는지 적기" })).toBeTruthy();
  });

  it("전에 적은 이름을 누르면 그대로 한 번 적힌다", async () => {
    const onSave = vi.fn(async () => true);
    render(<CompanionEditor value={null} suggestions={["민수", "가족"]} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "+ 누구와 갔는지 적기" }));
    const chip = screen.getByRole("button", { name: "민수" });
    fireEvent.mouseDown(chip);
    fireEvent.click(chip);
    fireEvent.blur(screen.queryByLabelText("누구와 갔나요") ?? document.body);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("민수");
  });

  it("직접 써서 Enter 로 적는다", async () => {
    const onSave = vi.fn(async () => true);
    render(<CompanionEditor value={null} suggestions={[]} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "+ 누구와 갔는지 적기" }));
    const input = screen.getByLabelText("누구와 갔나요");
    fireEvent.change(input, { target: { value: "지영" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("지영"));
    expect(await screen.findByText("· 적어 뒀어요")).toBeTruthy();
  });

  it("Esc 로 버리면 적지 않는다", () => {
    const onSave = vi.fn(async () => true);
    render(<CompanionEditor value="가족" suggestions={[]} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /누구와: 가족/ }));
    const input = screen.getByLabelText("누구와 갔나요");
    fireEvent.change(input, { target: { value: "버릴 이름" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("적어 둔 것은 '누구와 함께'로 보이고, 비우면 지운다", async () => {
    const onSave = vi.fn(async () => true);
    render(<CompanionEditor value="민수" suggestions={[]} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /민수와 함께|누구와: 민수/ }));
    const input = screen.getByLabelText("누구와 갔나요");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(""));
  });
});
