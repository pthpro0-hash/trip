import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionPanel, SIDO_ORDER } from "./CollectionPanel";
import { EchoCard } from "./EchoCard";
import { SpotPeek } from "./SpotPeek";
import { spotFocus } from "@/lib/scrollMemory";
import type { HubPlace } from "@/lib/hub";
import type { Spot } from "@/lib/types";

describe("CollectionPanel", () => {
  const tally = new Map([
    ["강원", 5],
    ["부산", 2],
  ]);

  it("17개 시도를 다 늘어놓고, 밟은 곳을 센다", () => {
    render(
      <CollectionPanel
        tally={tally}
        rangeText={null}
        curatedVisited={1}
        curatedTotal={121}
        onSido={() => {}}
      />,
    );
    expect(SIDO_ORDER).toHaveLength(17);
    expect(screen.getByText("17개 시도 중 2곳")).toBeTruthy();
    expect(screen.getByText(/100선 121곳 중 1곳/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "강원 5곳 다녀옴" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "제주 아직 안 가 봄" })).toBeTruthy();
  });

  it("밟은 곳과 안 밟은 곳을 누르면 무엇을 눌렀는지 알린다", () => {
    const onSido = vi.fn();
    render(
      <CollectionPanel tally={tally} rangeText={null} curatedVisited={0} curatedTotal={121} onSido={onSido} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "강원 5곳 다녀옴" }));
    expect(onSido).toHaveBeenLastCalledWith("강원", true);
    fireEvent.click(screen.getByRole("button", { name: "제주 아직 안 가 봄" }));
    expect(onSido).toHaveBeenLastCalledWith("제주", false);
  });

  it("기간을 골랐으면 무엇을 센 것인지 밝힌다", () => {
    render(
      <CollectionPanel
        tally={tally}
        rangeText="2026.01 ~ 2026.06"
        curatedVisited={0}
        curatedTotal={121}
        onSido={() => {}}
      />,
    );
    expect(screen.getByText(/2026.01 ~ 2026.06에 밟은 곳/)).toBeTruthy();
  });
});

describe("EchoCard", () => {
  const place: HubPlace = {
    visitId: "v1",
    tripId: "t1",
    tripLabel: "민수랑 첫 휴가",
    placeName: "안목해변",
    lat: 37.77,
    lng: 128.95,
    startedAt: "2025-09-27 10:00:00",
    photoCount: 18,
    coverPath: "나/v1/a.webp",
  };

  it("몇 해 전인지와 그곳을 보이고, 누르면 그곳을 연다", () => {
    const onOpen = vi.fn();
    render(<EchoCard echo={{ place, yearsAgo: 1, exact: true }} photo={undefined} onOpen={onOpen} />);
    expect(screen.getByText("1년 전 오늘")).toBeTruthy();
    expect(screen.getByText("안목해변")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith(place);
  });
});

describe("SpotPeek", () => {
  const spot: Spot = {
    id: "gyeongbokgung", name: "경복궁", region: "수도권", lat: 37.58, lng: 126.98,
    summary: "조선 왕조의 법궁", highlights: [], seasons: ["봄"], specialty: [], foods: [], themes: ["역사유적"],
  };

  it("자세히 보러 가면 이 지도로 돌아오게 적어 둔다", () => {
    window.sessionStorage.clear();
    render(<SpotPeek spot={spot} thumbnail={undefined} />);
    const link = screen.getByRole("link", { name: /자세히 보기/ });
    expect(link).toHaveAttribute("href", "/spots/gyeongbokgung");
    fireEvent.click(link);
    expect(spotFocus.from()).toBe("/?v=sketch");
  });

  it("지도를 떠나지 않고 담을 수 있다", () => {
    window.localStorage.clear();
    render(<SpotPeek spot={spot} thumbnail={undefined} />);
    expect(screen.getByRole("button", { name: /경복궁 가고 싶은 곳에 담기/ })).toBeTruthy();
  });
});
