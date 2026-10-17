import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { buildExample } from "@/lib/example";
import { SPOTS_HREF } from "@/lib/nav";
import { ExampleView } from "./ExampleView";

// 사진 칸은 따로 시험한다 — 여기서는 무엇을 어떤 차례로 말하는지를 본다.
/* eslint-disable @next/next/no-img-element -- next/image 를 가짜 <img> 로 바꾼 시험용 */
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

/*
  예시 여행 — 사진 → 여행으로 정리 → 지도와 한 장 카드, 세 걸음을 한 화면에서. 예시라는 것을 분명히 말하고 내 사진으로 이어 준다.
*/
const example = buildExample()!;

describe("ExampleView", () => {
  it("예시라는 것, 내 사진이나 기록이 아니라는 것을 맨 위에서 말한다", () => {
    render(<ExampleView example={example} />);
    expect(screen.getByRole("heading", { level: 1, name: "사진만 고르면, 이렇게 돼요" })).toBeTruthy();
    expect(screen.getByText("예시")).toBeTruthy();
    expect(screen.getByText(/내 사진이나 기록이 아니에요/)).toBeTruthy();
  });

  it("세 걸음이 차례로 있다 — 사진 · 여행으로 정리 · 지도와 한 장 카드", () => {
    render(<ExampleView example={example} />);
    const steps = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(steps).toEqual(["사진을 고르면", "날짜와 장소로 여행이 묶여요", "지도와 한 장 카드로 남아요"]);
  });

  it("1단계 — 사진 여섯 장과 읽히는 촬영 시각을 보여 준다", () => {
    render(<ExampleView example={example} />);
    expect(screen.getAllByRole("img", { name: /사진$/ })).toHaveLength(6);
    expect(screen.getByText(example.photos[0].takenAt)).toBeTruthy();
    expect(screen.getByText(/읽는 동안 사진은 이 기기 밖으로 나가지 않아요/)).toBeTruthy();
  });

  it("2단계 — 여행 카드의 제목·기간·들른 곳을 보여 준다", () => {
    render(<ExampleView example={example} />);
    expect(screen.getByText(example.title)).toBeTruthy();
    expect(screen.getByText(/사진 6장 · 방문 3곳/)).toBeTruthy();
    for (const visit of example.visits) {
      expect(screen.getAllByText(visit.placeName).length).toBeGreaterThan(0);
      expect(screen.getByText(visit.when)).toBeTruthy();
    }
  });

  it("3단계 — 실제 한 장 카드(그림)가 그려진다", () => {
    const { container } = render(<ExampleView example={example} />);
    const card = container.querySelector('svg[viewBox="0 0 720 1060"]');
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain(example.snapshot.headline);
  });

  it("내 사진으로 이어 준다 — 사진 고르기와, 갈 곳 찾기(여행 100선)", () => {
    render(<ExampleView example={example} />);
    expect(screen.getByRole("link", { name: "내 사진으로 만들어 보기" })).toHaveAttribute("href", "/trips/new");
    expect(screen.getByRole("link", { name: "가 볼 곳은 한국관광 100선에서 찾아요" })).toHaveAttribute("href", SPOTS_HREF);
  });

  it("사진의 출처를 밝힌다", () => {
    const { container } = render(<ExampleView example={example} />);
    expect(within(container).getByText(/한국관광공사/)).toBeTruthy();
  });
});
