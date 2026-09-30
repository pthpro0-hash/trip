import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HubPlace } from "@/lib/hub";

vi.mock("@/lib/useWide", () => ({ useWide: () => false }));
// 카카오 지도는 시험 안에서 띄울 수 없다. 여기서 보는 것은 지도 밖의 배치다.
vi.mock("./HubMap", async () => {
  const React = await import("react");
  return {
    HubMap: React.forwardRef(function HubMapStub() {
      return null;
    }),
  };
});
const { HubView } = await import("./SketchHub");

const place: HubPlace = {
  visitId: "v1",
  tripId: "t1",
  tripLabel: "강릉 바다",
  placeName: "안목해변",
  lat: 37.77,
  lng: 128.95,
  startedAt: "2026-08-13 09:00:00",
  photoCount: 12,
  coverPath: null,
  dong: null,
  spotId: null,
};

const open = (onList?: () => void) =>
  render(
    <HubView
      status="ready"
      userId="u1"
      trips={[{ id: "t1", startedOn: "2026-08-13" }]}
      places={[place]}
      pinUrls={new Map()}
      returnTrip={null}
      switcher={<span>갈래 스위치</span>}
      onList={onList}
    />,
  );

/*
  폰에는 아래에 하단 탭이 있다. 지도 시트의 머리에 있던 "사진 고르기 · 한장 요약" 단추는
  폰에서 그것과 같은 일을 하므로 접고, 지도와 목록을 오가는 스위치만 남긴다.
*/
describe("HubView · 지도 시트의 머리", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("지도와 목록 스위치가 있고, 지도가 켜져 있다", () => {
    open(() => undefined);
    expect(screen.getByRole("radio", { name: "지도" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "목록" })).toHaveAttribute("aria-checked", "false");
  });

  it("목록 모습으로 넘어가는 길을 주지 않으면 스위치를 두지 않는다", () => {
    open();
    expect(screen.queryByRole("radiogroup", { name: "보기 방식" })).toBeNull();
  });

  it("사진 고르기와 한장 요약 단추는 폰에서 접는다 — 하단 탭이 그 일을 한다", () => {
    open(() => undefined);
    const add = screen.getByRole("link", { name: "+ 사진 고르기" });
    const sketch = screen.getByRole("link", { name: "한장 요약" });
    expect(add).toHaveAttribute("href", "/trips/new");
    expect(sketch).toHaveAttribute("href", "/sketch");
    expect(add.className).toContain("max-sm:hidden");
    expect(sketch.className).toContain("max-sm:hidden");
  });

  it("예전 '여행 목록' 링크(/trips)는 스위치로 바뀌었다", () => {
    open(() => undefined);
    expect(screen.queryByRole("link", { name: "여행 목록" })).toBeNull();
    expect(document.querySelector('a[href="/trips"]')).toBeNull();
  });

  it("큰 갈래 스위치는 폰에서 접는다 — 하단 탭이 그 일을 한다", () => {
    open(() => undefined);
    expect(screen.getByText("갈래 스위치").parentElement!.parentElement!.className).toContain("max-sm:hidden");
  });

  it("지도 틀의 높이는 하단 탭이 차지한 만큼을 뺀다", () => {
    const { container } = open(() => undefined);
    expect((container.firstElementChild as HTMLElement).className).toContain("var(--bottom-nav-h,0px)");
  });
});
