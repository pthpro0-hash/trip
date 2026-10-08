import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";
import { headline } from "@/lib/sketchWords";
import { yearsStory } from "@/lib/yearsStory";
import { AllYearsShowcase } from "./AllYearsShowcase";

const trip = (id: string, startedOn: string): SketchTrip => ({
  id,
  startedOn,
  endedOn: startedOn,
  companions: null,
  visits: [{ placeName: id, spotId: null, lat: 37.77, lng: 128.95, photoCount: 4, dong: null, photoPath: null }],
});

const all = [trip("a", "2024-05-01"), trip("b", "2025-04-01"), trip("c", "2025-08-01")];

describe("AllYearsShowcase", () => {
  it("해마다 색을 달리한 한 장과, 해마다 한 줄", () => {
    render(<AllYearsShowcase all={all} sidoOf={undefined} onPickYear={() => {}} />);
    expect(screen.getByRole("img", { name: /2024년 1번, 2025년 2번/ })).toBeTruthy();
    expect(screen.getByText("2년 동안 세 번 떠났어요")).toBeTruthy();
    expect(screen.getByText(/가장 많이 떠난 해는/)).toBeTruthy();
  });

  it("한 줄은 카드 안에만 있다 — 카드 위에 같은 말을 또 크게 적지 않는다", () => {
    const { container } = render(<AllYearsShowcase all={all} sidoOf={undefined} onPickYear={() => {}} />);
    const line = headline(yearsStory(all, undefined).total, "all");
    const found = screen.getAllByText(line);
    expect(found).toHaveLength(1);
    expect(found[0].closest("svg")).toBe(container.querySelector("svg"));
  });

  it("저장 막대에는 이미지 저장과 링크 공유뿐 — 스토리용 세로는 없다", () => {
    render(<AllYearsShowcase all={all} sidoOf={undefined} onPickYear={() => {}} userId="u1" />);
    expect(screen.queryByRole("button", { name: /스토리/ })).toBeNull();
    const bar = screen.getByRole("button", { name: "지금까지 이미지 저장" }).parentElement!;
    expect(within(bar).getAllByRole("button").map((button) => button.textContent)).toEqual(["이미지 저장", "링크 공유"]);
  });

  it("해 줄을 누르면 그해 한 장으로 넘어간다", () => {
    const onPickYear = vi.fn();
    render(<AllYearsShowcase all={all} sidoOf={undefined} onPickYear={onPickYear} />);
    fireEvent.click(screen.getByRole("button", { name: "2024년 한 장 보기" }));
    expect(onPickYear).toHaveBeenCalledWith(2024);
  });
});
