import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/me/MyInfo", () => ({ MyInfo: () => <p>내 정보 내용</p> }));

const { default: MePage, metadata } = await import("./page");

describe("MePage · /me", () => {
  it("내 정보 메뉴를 그린다", () => {
    render(<MePage />);
    expect(screen.getByText("내 정보 내용")).toBeTruthy();
  });

  it("검색에 나오지 않는다 — 내 계정 화면이다", () => {
    expect(metadata.title).toBe("내 정보");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
