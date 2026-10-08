import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";
import { yearsStory } from "@/lib/yearsStory";
import { sidoShapes } from "@/lib/sidoShapes";
import { YearsCard } from "./YearsCard";

const trip = (id: string, startedOn: string): SketchTrip => ({
  id,
  startedOn,
  endedOn: startedOn,
  companions: null,
  visits: [{ placeName: id, spotId: null, lat: 37.77, lng: 128.95, photoCount: 4, dong: null, photoPath: null }],
});

/*
  '지금까지' 카드의 지도도 지도형 카드처럼 해안선만이 아니라 시도 경계를 깐다.
  크기는 그대로 — 아래에 해마다 막대가 서 있어 자리가 없다.
*/
describe("YearsCard · 지도", () => {
  const story = yearsStory([trip("a", "2024-05-01"), trip("b", "2025-04-01")]);
  const draw = () =>
    render(<YearsCard stats={story.total} headline="2년 동안 두 번" layers={story.layers} rows={story.rows} />);

  it("시도 경계가 깔린다", () => {
    const { container } = draw();
    const paths = container.querySelectorAll("[data-basemap] path");
    expect(paths.length).toBe(sidoShapes().list.length);
    for (const path of paths) expect(path.getAttribute("stroke")).toBeTruthy();
  });

  it("판은 그대로 720×1060이다", () => {
    const { container } = draw();
    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 720 1060");
  });
});
