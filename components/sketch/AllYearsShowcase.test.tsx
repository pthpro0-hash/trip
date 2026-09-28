import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";
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

  it("해 줄을 누르면 그해 한 장으로 넘어간다", () => {
    const onPickYear = vi.fn();
    render(<AllYearsShowcase all={all} sidoOf={undefined} onPickYear={onPickYear} />);
    fireEvent.click(screen.getByRole("button", { name: "2024년 한 장 보기" }));
    expect(onPickYear).toHaveBeenCalledWith(2024);
  });
});
