import { describe, it, expect, vi, beforeEach } from "vitest";
import { cancelLaunch, launchOpened, launchPicker, receiveFiles, registerLauncherInput, subscribeLaunch, takePendingFiles } from "./launch";

/* 어느 화면의 [사진 고르기]든 숨은 입력칸으로 사진첩을 연 채 '사진으로 여행 추가'로 가고, 고른 사진은 그 화면이 받아 간다. */
const input = () => {
  const el = document.createElement("input");
  el.click = vi.fn();
  return el;
};
const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

beforeEach(() => {
  registerLauncherInput(null);
  cancelLaunch();
  takePendingFiles();
});

describe("launch", () => {
  it("입력칸이 없으면 열지 못한다 — 부르는 쪽은 평소 링크로 간다", () => {
    expect(launchPicker()).toBe(false);
    expect(launchOpened()).toBe(false);
  });

  it("누르면 입력칸을 눌러 사진첩을 열고, 열려 있다고 알린다", () => {
    const el = input();
    registerLauncherInput(el);
    const seen = vi.fn();
    subscribeLaunch(seen);
    expect(launchPicker()).toBe(true);
    expect(el.click).toHaveBeenCalledTimes(1);
    expect(launchOpened()).toBe(true);
    expect(seen).toHaveBeenCalled();
  });

  it("고른 사진은 한 번만 가져간다", () => {
    receiveFiles([file("a.jpg")]);
    expect(takePendingFiles()?.map((f) => f.name)).toEqual(["a.jpg"]);
    expect(takePendingFiles()).toBeNull();
    expect(launchOpened()).toBe(false);
  });

  it("고르지 않고 닫으면(취소) 열려 있지 않다고 알리고 가져갈 것은 없다", () => {
    registerLauncherInput(input());
    launchPicker();
    const seen = vi.fn();
    subscribeLaunch(seen);
    cancelLaunch();
    expect(launchOpened()).toBe(false);
    expect(seen).toHaveBeenCalled();
    expect(takePendingFiles()).toBeNull();
  });

  it("빈 선택은 사진이 온 것이 아니다", () => {
    receiveFiles([]);
    expect(takePendingFiles()).toBeNull();
  });
});
