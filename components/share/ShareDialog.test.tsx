import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { yearStory } from "@/lib/sketchStory";
import { yearsStory } from "@/lib/yearsStory";
import { allShareSource, yearShareSource } from "@/lib/share";

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
      source={yearShareSource({
        year: 2026,
        style: "map",
        headline: "바다를 본 해",
        sketch: buildSketch(all),
        shapes: sketchShapes(all),
        months: monthStrip(all),
        story,
      })}
      headline="바다를 본 해"
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

/*
  "전체"도 같은 창이다. 전체 카드에는 사진이 없으니 사진까지는 막히고,
  지도로 시작한다. 제목은 "지금까지를".
*/
describe("ShareDialog · 전체", () => {
  const several: SketchTrip[] = [
    { ...trips[0], id: "a", startedOn: "2025-05-01", endedOn: "2025-05-01" },
    { ...trips[0], id: "b", startedOn: "2026-08-13", endedOn: "2026-08-13" },
  ];
  const openAll = () => {
    const story = yearsStory(several, (visit) => visit.dong?.split(" ")[0] ?? null);
    render(
      <ShareDialog
        userId="u1"
        source={allShareSource({ headline: "바다만 두 번", story })}
        headline="바다만 두 번"
        localPhotos={new Map()}
        onClose={() => {}}
      />,
    );
  };

  it("지금까지를 링크로 — 사진까지는 막히고 지도로 시작한다", () => {
    openAll();
    expect(screen.getByRole("heading", { name: "지금까지를 링크로 보여 주기" })).toBeTruthy();
    expect((screen.getByRole("radio", { name: "사진까지" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("radio", { name: "지도만" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/전체 한 장에는 사진이 들어가지 않아요/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /지금까지 바다만 두 번 — 2025년 1번, 2026년 1번/ })).toBeTruthy();
  });

  it("시도 이름만이면 모든 해의 시도를 칠한 카드", () => {
    openAll();
    fireEvent.click(screen.getByRole("radio", { name: "시도 이름만" }));
    expect(screen.getByRole("img", { name: /밟은 시도 1곳: 강원/ })).toBeTruthy();
  });
});
