import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpotCard } from "./SpotCard";
import type { Spot } from "@/lib/types";

const SPOT: Spot = {
  id: "gyeongbokgung", name: "경복궁", region: "수도권", lat: 37.5796, lng: 126.977,
  summary: "조선 왕조의 법궁", highlights: ["근정전"], seasons: ["봄", "가을"],
  specialty: ["경기미"], foods: ["설렁탕", "왕갈비"], themes: ["역사유적"],
};

describe("SpotCard", () => {
  it("이름과 대표 음식을 표시한다", () => {
    render(<SpotCard spot={SPOT} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("경복궁")).toBeTruthy();
    expect(screen.getByText("설렁탕")).toBeTruthy();
  });

  it("클릭하면 onSelect가 spot id와 함께 호출된다", () => {
    const onSelect = vi.fn();
    render(<SpotCard spot={SPOT} selected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("gyeongbokgung");
  });

  it("상세 페이지로 이동하는 링크를 포함한다", () => {
    render(<SpotCard spot={SPOT} selected={false} onSelect={() => {}} />);
    const link = screen.getByRole("link", { name: /자세히 보기/ });
    expect(link).toHaveAttribute("href", "/spots/gyeongbokgung");
  });
});
