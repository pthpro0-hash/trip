import { describe, it, expect } from "vitest";
import { layoutLabels } from "./mapLabels";

const viewBox = { x: 0, y: 0, width: 400, height: 400 };
const options = { viewBox, fontSize: 10, pinHeight: 14 };

describe("layoutLabels", () => {
  it("입력 순서를 유지한다", () => {
    const placed = layoutLabels(
      [
        { id: "b", text: "부산", anchor: { x: 200, y: 300 } },
        { id: "a", text: "서울", anchor: { x: 100, y: 100 } },
      ],
      options,
    );
    expect(placed.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("떨어져 있는 라벨은 모두 표시하고 서로 겹치지 않는다", () => {
    const placed = layoutLabels(
      [
        { id: "a", text: "경복궁", anchor: { x: 80, y: 80 } },
        { id: "b", text: "해운대", anchor: { x: 250, y: 250 } },
      ],
      options,
    );
    expect(placed.every((p) => p.visible)).toBe(true);

    const [a, b] = placed;
    const noOverlap =
      a.x + a.width / 2 <= b.x - b.width / 2 ||
      b.x + b.width / 2 <= a.x - a.width / 2 ||
      a.y + a.height <= b.y ||
      b.y + b.height <= a.y;
    expect(noOverlap).toBe(true);
  });

  it("같은 자리에 겹쳐 쌓이면 일부는 숨긴다", () => {
    const crowded = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      text: "관광지이름",
      anchor: { x: 200, y: 200 },
    }));
    const placed = layoutLabels(crowded, options);
    expect(placed.some((p) => !p.visible)).toBe(true);
  });

  it("viewBox를 벗어나는 자리에는 라벨을 두지 않는다", () => {
    const placed = layoutLabels(
      [{ id: "edge", text: "아주아주긴관광지이름입니다", anchor: { x: 395, y: 395 } }],
      options,
    );
    const [label] = placed;
    if (label.visible) {
      expect(label.x - label.width / 2).toBeGreaterThanOrEqual(viewBox.x);
      expect(label.y + label.height).toBeLessThanOrEqual(viewBox.y + viewBox.height);
    } else {
      expect(label.visible).toBe(false);
    }
  });
});
