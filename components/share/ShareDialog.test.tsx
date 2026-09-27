import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { yearStory } from "@/lib/sketchStory";

vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => null }));
const { ShareDialog } = await import("./ShareDialog");

const trips: SketchTrip[] = [
  {
    id: "t1",
    startedOn: "2026-08-13",
    endedOn: "2026-08-14",
    companions: "민수",
    visits: [
      { placeName: "안목해변", spotId: null, lat: 37.77, lng: 128.95, photoCount: 18, dong: "강원 강릉시", photoPath: "a.webp" },
    ],
  },
];

const open = (sido = true, withPhotos = true) => {
  const all = withPhotos ? trips : [{ ...trips[0], visits: [{ ...trips[0].visits[0], photoPath: null }] }];
  const story = yearStory(all, 2026, sido ? (visit) => visit.dong?.split(" ")[0] ?? null : undefined);
  render(
    <ShareDialog
      userId="u1"
      year={2026}
      style="map"
      headline="바다를 본 해"
      sketch={buildSketch(all)}
      shapes={sketchShapes(all)}
      months={monthStrip(all)}
      story={story}
      localPhotos={new Map()}
      onClose={() => {}}
    />,
  );
};

/*
  고른 범위가 곧 남이 볼 모습이다. 미리보기가 그 범위를 그대로 따라가야
  "보고 나서 만든다"가 성립한다.
*/
describe("ShareDialog", () => {
  it("세 범위를 고를 수 있고, 처음에는 사진까지", () => {
    open();
    expect(screen.getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["사진까지", "지도만", "시도 이름만"]);
    expect(screen.getByRole("radio", { name: "사진까지" }).getAttribute("aria-checked")).toBe("true");
  });

  it("시도 이름만을 고르면 미리보기가 시도 카드로 — 곳 이름이 사라진다", () => {
    open();
    expect(screen.getByRole("img", { name: /2026년 바다를 본 해 — 여행 1번/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "시도 이름만" }));
    const card = screen.getByRole("img", { name: /밟은 시도 1곳: 강원/ });
    expect(card.textContent).not.toContain("안목해변");
  });

  it("사진이 없는 해는 사진까지를, 시도를 못 가린 해는 시도 이름만을 고를 수 없다", () => {
    open(false, false);
    expect((screen.getByRole("radio", { name: "사진까지" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "시도 이름만" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("radio", { name: "지도만" }).getAttribute("aria-checked")).toBe("true");
  });

  it("함께한 사람은 어느 범위에서도 싣지 않는다고 알린다", () => {
    open();
    expect(screen.getByText(/함께한 사람과 날짜는 어느 쪽이든/)).toBeTruthy();
    expect(document.body.textContent).not.toContain("민수");
  });
});
