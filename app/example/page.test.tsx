import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/* eslint-disable @next/next/no-img-element -- next/image 를 가짜 <img> 로 바꾼 시험용 */
vi.mock("next/image", () => ({ default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} /> }));
const { default: ExamplePage, metadata } = await import("./page");

/* 예시 여행 페이지 — 로그인도 서버 호출도 없이 그려지고, 검색에 걸리는 이름이 있다. */
describe("/example", () => {
  it("로그인 없이 그려진다", () => {
    render(<ExamplePage />);
    expect(screen.getByRole("heading", { level: 1, name: "사진만 고르면, 이렇게 돼요" })).toBeTruthy();
  });

  it("검색에 걸리는 제목·설명과 대표 주소가 있다", () => {
    expect(metadata.title).toBe("예시 여행 보기");
    expect(String(metadata.description)).toContain("사진만 고르면");
    expect(metadata.alternates?.canonical).toBe("/example");
  });
});
