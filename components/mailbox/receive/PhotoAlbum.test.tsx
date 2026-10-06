import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhotoAlbum } from "./PhotoAlbum";

const PID = "P".repeat(43);
const files = ["a.webp", "b.webp", "c.webp"];
const srcOf = (container: HTMLElement) => container.querySelector("img")?.getAttribute("src") ?? "";

describe("PhotoAlbum · 책 한 권의 사진을 한 장씩 넘겨 본다", () => {
  it("사진이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("첫 사진이 크게 보이고 '1 / 3'으로 몇 번째인지 알린다", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={files} />);
    expect(srcOf(container)).toMatch(/\/postcards\/P+\/a\.webp$/);
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("다음·이전 단추로 넘긴다 — 처음에는 이전이, 끝에서는 다음이 막힌다", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={files} />);
    const prev = screen.getByRole("button", { name: "이전 사진" });
    const next = screen.getByRole("button", { name: "다음 사진" });
    expect(prev).toBeDisabled();
    fireEvent.click(next);
    expect(srcOf(container)).toMatch(/b\.webp$/);
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.click(next);
    expect(srcOf(container)).toMatch(/c\.webp$/);
    expect(next).toBeDisabled();
    fireEvent.click(prev);
    expect(srcOf(container)).toMatch(/b\.webp$/);
  });

  it("손가락으로 옆으로 밀어도 넘어간다 — 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={files} />);
    const surface = screen.getByRole("group", { name: "사진 앨범" });
    fireEvent.pointerDown(surface, { clientX: 300, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 180, clientY: 104, pointerId: 1 });
    expect(srcOf(container)).toMatch(/b\.webp$/);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 220, clientY: 96, pointerId: 1 });
    expect(srcOf(container)).toMatch(/a\.webp$/);
  });

  it("짧게 누르거나 위아래로 민 것은 넘기지 않는다 — 화면을 굴리는 손가락을 사진 넘기기로 오해하지 않는다", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={files} />);
    const surface = screen.getByRole("group", { name: "사진 앨범" });
    fireEvent.pointerDown(surface, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 190, clientY: 100, pointerId: 1 });
    fireEvent.pointerDown(surface, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 150, clientY: 260, pointerId: 1 });
    expect(srcOf(container)).toMatch(/a\.webp$/);
  });

  it("키보드 화살표로도 넘긴다", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={files} />);
    const surface = screen.getByRole("group", { name: "사진 앨범" });
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    expect(srcOf(container)).toMatch(/b\.webp$/);
    fireEvent.keyDown(surface, { key: "ArrowLeft" });
    expect(srcOf(container)).toMatch(/a\.webp$/);
  });

  it("사진이 한 장이면 넘기는 단추와 쪽수가 없다", () => {
    render(<PhotoAlbum postcardId={PID} files={["a.webp"]} />);
    expect(screen.queryByRole("button", { name: "다음 사진" })).toBeNull();
    expect(screen.queryByText(/\//)).toBeNull();
  });

  it("지워진 사진은 그 쪽만 부드러운 안내로 바뀐다 — 다른 쪽은 그대로 넘겨 볼 수 있다", () => {
    const { container } = render(<PhotoAlbum postcardId={PID} files={files} />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("보낸 분이 이 사진을 지웠어요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    expect(srcOf(container)).toMatch(/b\.webp$/);
    expect(screen.queryByText("보낸 분이 이 사진을 지웠어요")).toBeNull();
  });
});
