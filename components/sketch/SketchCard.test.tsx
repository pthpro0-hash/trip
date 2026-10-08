import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { sidoShapes } from "@/lib/sidoShapes";
import { SketchCard } from "./SketchCard";

const trip = (id: string, startedOn: string, visits: [string, number, number, number][]): SketchTrip => ({
  id,
  startedOn,
  endedOn: startedOn,
  companions: null,
  visits: visits.map(([placeName, lat, lng, photoCount]) => ({
    placeName,
    spotId: null,
    lat,
    lng,
    photoCount,
    dong: null,
    photoPath: null,
    visitedOn: startedOn,
  })),
});

const trips = [
  trip("a", "2026-03-01", [["경복궁", 37.57, 126.98, 12], ["안목해변", 37.77, 128.95, 30]]),
  trip("b", "2026-08-13", [["해운대", 35.16, 129.16, 20], ["우도", 33.5, 126.95, 9]]),
];

const draw = (list: SketchTrip[] = trips) => {
  const sketch = buildSketch(list);
  return render(
    <SketchCard
      sketch={sketch}
      shapes={sketchShapes(list)}
      title="2026년"
      headline="바다를 두 번 본 해"
      months={monthStrip(list)}
      region={null}
      photos={new Map()}
    />,
  );
};

/*
  지도형 카드. 지도가 카드 폭의 1/3 도 안 돼 손톱만 했고, 해안선만 있어서 어느 도인지 알 수 없었다.
  지도를 키우고 시도 경계를 깔며, 자리는 머리와 숫자 칸을 줄여 만든다. 카드 판(720×1060)은 그대로다.
*/
describe("SketchCard · 지도", () => {
  const mapFrame = (container: HTMLElement) => {
    const rect = container.querySelector("#sketch-map rect")!;
    return {
      x: Number(rect.getAttribute("x")),
      y: Number(rect.getAttribute("y")),
      width: Number(rect.getAttribute("width")),
      height: Number(rect.getAttribute("height")),
    };
  };

  it("판은 그대로 720×1060이다 — 저장·링크 공유·다른 모양과 같은 크기", () => {
    const { container } = draw();
    expect(container.querySelector("svg")!.getAttribute("viewBox")).toBe("0 0 720 1060");
  });

  it("지도가 지금(세로 450, 가로 255)보다 20~30% 크다", () => {
    const { container } = draw();
    const frame = mapFrame(container);
    expect(frame.height / 450).toBeGreaterThanOrEqual(1.2);
    expect(frame.height / 450).toBeLessThanOrEqual(1.3);
    expect(frame.width / 255).toBeGreaterThanOrEqual(1.2);
    expect(frame.width / 255).toBeLessThanOrEqual(1.3);
  });

  it("지도는 가운데에 선다", () => {
    const { container } = draw();
    const frame = mapFrame(container);
    expect(frame.x + frame.width / 2).toBeCloseTo(360, 0);
  });

  it("해안선만이 아니라 시도 경계가 깔린다 — 발자취 지도와 같은 경계", () => {
    const { container } = draw();
    const paths = container.querySelectorAll("[data-basemap] path");
    expect(paths.length).toBe(sidoShapes().list.length);
    expect(paths.length).toBeGreaterThanOrEqual(17);
    for (const path of paths) {
      expect(path.getAttribute("stroke")).toBeTruthy();
      expect(path.getAttribute("fill-rule")).toBe("evenodd");
    }
  });

  it("경계선은 폰 크기에서도 보일 만큼 굵다 — 카드가 화면에서는 절반 아래로 줄어든다", () => {
    const { container } = draw();
    const width = Number(container.querySelector("[data-basemap] path")!.getAttribute("stroke-width"));
    expect(width).toBeGreaterThanOrEqual(1.8);
  });

  it("머리가 지도를 덜 밀어낸다 — 지도가 한 줄 제목 바로 밑에서 시작한다", () => {
    const { container } = draw();
    expect(mapFrame(container).y).toBeLessThanOrEqual(160);
    const headline = [...container.querySelectorAll("text")].find((node) => node.textContent === "바다를 두 번 본 해")!;
    expect(Number(headline.getAttribute("y"))).toBeLessThan(mapFrame(container).y);
  });

  it("다닌 곳의 점이 그대로 얹힌다", () => {
    const { container } = draw();
    expect(container.querySelectorAll("#sketch-map ~ g circle, g[clip-path] circle").length).toBeGreaterThan(0);
  });
});

describe("SketchCard · 숫자 칸", () => {
  const stats = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-stat]")].map((node) => {
      const [x, y] = node.getAttribute("transform")!.match(/-?\d+(\.\d+)?/g)!.map(Number);
      return { label: node.getAttribute("data-stat")!, x, y, text: node.textContent ?? "" };
    });

  it("네 가지(여행·다녀온 곳·사진·오간 거리)를 두 줄 두 칸으로 묶는다", () => {
    const { container } = draw();
    const cells = stats(container);
    expect(cells.map((cell) => cell.label)).toEqual(["여행", "다녀온 곳", "사진", "오간 거리"]);
    expect(new Set(cells.map((cell) => cell.y)).size).toBe(2);
    expect(new Set(cells.map((cell) => cell.x)).size).toBe(2);
  });

  it("값과 풀이가 그대로 있다 — 숫자 밑에 한 줄씩", () => {
    const { container } = draw();
    const cells = stats(container);
    expect(cells[0].text).toContain("2번");
    expect(cells[1].text).toContain("4곳");
    expect(cells[2].text).toContain("71장");
  });

  it("오간 거리가 없으면 세 칸 — 마지막 칸이 비어도 어긋나지 않는다", () => {
    const { container } = draw([trip("a", "2026-03-01", [["경복궁", 37.57, 126.98, 12]])]);
    const cells = stats(container);
    expect(cells.map((cell) => cell.label)).toEqual(["여행", "다녀온 곳", "사진"]);
  });

  it("숫자 칸이 서명 위에서 끝난다 — 카드 밖으로 넘치지 않는다", () => {
    const { container } = draw();
    const lastRow = Math.max(...stats(container).map((cell) => cell.y));
    const signature = [...container.querySelectorAll("text")].find((node) => node.textContent === "내 여행 스케치")!;
    // 칸 하나는 아래로 약 46 이어진다.
    expect(lastRow + 50).toBeLessThan(Number(signature.getAttribute("y")) - 8);
  });

  it("월 띠와 계절 설명은 지도 바로 아래에 남는다", () => {
    const { container } = draw();
    expect(container.textContent).toContain("점이 클수록 사진이 많은 곳");
    for (const month of ["1", "12"]) expect(container.textContent).toContain(month);
  });
});
