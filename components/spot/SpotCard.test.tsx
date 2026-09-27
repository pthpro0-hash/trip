import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpotCard } from "./SpotCard";
import { spotFocus } from "@/lib/scrollMemory";
import type { Spot } from "@/lib/types";

const SPOT: Spot = {
  id: "gyeongbokgung", name: "경복궁", region: "수도권", lat: 37.5796, lng: 126.977,
  summary: "조선 왕조의 법궁", highlights: ["근정전"], seasons: ["봄", "가을"],
  specialty: ["경기미"], foods: ["설렁탕", "왕갈비"], themes: ["역사유적"],
};

describe("SpotCard", () => {
  it("이름과 대표 음식을 표시한다", () => {
    render(<SpotCard spot={SPOT} selected={false} />);
    expect(screen.getByText("경복궁")).toBeTruthy();
    expect(screen.getByText("설렁탕")).toBeTruthy();
  });

  /*
    제목이나 "자세히 보기"를 정확히 겨눠야 하면 손가락으로는 번번이
    빗나간다. 카드 어디를 눌러도 상세로 가야 한다.
  */
  it("카드 어디를 눌러도 상세로 가는 길이 덮여 있다", () => {
    render(<SpotCard spot={SPOT} selected={false} />);
    const cover = screen.getByRole("link", { name: "경복궁 자세히 보기" });
    expect(cover).toHaveAttribute("href", "/spots/gyeongbokgung");
  });

  it("덮개가 있어도 가고 싶은 곳 단추는 눌린다", () => {
    render(<SpotCard spot={SPOT} selected={false} />);
    // 단추가 덮개보다 위에 있어야 눌린다.
    const save = screen.getByRole("button", { name: "경복궁 가고 싶은 곳에 담기" });
    const cover = screen.getByRole("link", { name: "경복궁 자세히 보기" });
    expect(save.className).toContain("z-20");
    expect(cover.className).toContain("z-10");
  });

  it("가고 싶은 곳 버튼을 누르면 눌린 상태로 바뀐다", () => {
    window.localStorage.clear();
    render(<SpotCard spot={SPOT} selected={false} />);
    const save = screen.getByRole("button", { name: "경복궁 가고 싶은 곳에 담기" });
    expect(save).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(save);
    expect(screen.getByRole("button", { name: "경복궁 가고 싶은 곳에서 빼기" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  /*
    여행지 상세는 둘러보기에서도 권역별에서도 열린다. 돌아갈 곳이 둘이라
    상세 혼자서는 알 수 없고, 떠나올 때 카드가 적어 두어야 한다.
  */
  it("떠날 때 어디서 떠났는지 적어 둔다", () => {
    window.sessionStorage.clear();
    render(<SpotCard spot={SPOT} selected={false} />);

    fireEvent.click(screen.getByRole("link", { name: "경복궁 자세히 보기" }));

    expect(spotFocus.from()).toBe(window.location.pathname + window.location.search);
  });

  it("돌아와 선 카드에는 찾을 이름표와 테가 있다", () => {
    const { container } = render(
      <SpotCard spot={SPOT} selected={false} focused />,
    );
    const card = container.querySelector("#spot-gyeongbokgung");
    expect(card).toBeTruthy();
    expect(card?.className).toContain("ring-accent");
  });

  it("내 주변이 켜져 있으면 거리를 함께 보여준다", () => {
    render(
      <SpotCard spot={SPOT} selected={false} distanceKm={3.42} />,
    );
    expect(screen.getByText("수도권 · 3.4km")).toBeTruthy();
  });

  it("상세 페이지로 이동하는 링크를 포함한다", () => {
    render(<SpotCard spot={SPOT} selected={false} />);
    const link = screen.getByRole("link", { name: /자세히 보기/ });
    expect(link).toHaveAttribute("href", "/spots/gyeongbokgung");
  });
});
