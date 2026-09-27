import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SketchTrip } from "@/lib/sketch";

vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => null }));
const { SketchShowcase } = await import("./SketchShowcase");

const all: SketchTrip[] = [
  {
    id: "t1",
    startedOn: "2026-08-13",
    endedOn: "2026-08-14",
    companions: null,
    visits: [
      { placeName: "안목해변", spotId: null, lat: 37.77, lng: 128.95, photoCount: 18, dong: null, photoPath: null },
    ],
  },
];

/*
  그해의 한 줄은 화면이 먼저 지어 두지만, 그해가 어땠는지는 본인만
  안다. 고쳐 쓰는 길이 막히면 안 되고, 취소가 저장이 되어도 안 된다.
*/
describe("SketchShowcase · 한 줄", () => {
  it("화면이 지어 둔 말을 크게 보인다", () => {
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={async () => true} sidoOf={undefined} />);
    expect(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ })).toBeTruthy();
  });

  it("적어 둔 말이 있으면 그것을 보인다", () => {
    render(<SketchShowcase year={2026} all={all} written="민수랑 바다만 본 해" onWrite={async () => true} sidoOf={undefined} />);
    expect(screen.getAllByText("민수랑 바다만 본 해").length).toBeGreaterThan(0);
  });

  it("고쳐 쓰고 Enter 를 누르면 그해의 말로 적는다", async () => {
    const onWrite = vi.fn(async () => true);
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={onWrite} sidoOf={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ }));
    const input = screen.getByLabelText("2026년 한 줄");
    fireEvent.change(input, { target: { value: "바다를 세 번 본 해" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onWrite).toHaveBeenCalledWith(2026, "바다를 세 번 본 해");
  });

  it("Esc 로 취소하면 적지 않는다", () => {
    const onWrite = vi.fn(async () => true);
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={onWrite} sidoOf={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /한 줄 고쳐 쓰기/ }));
    const input = screen.getByLabelText("2026년 한 줄");
    fireEvent.change(input, { target: { value: "버릴 말" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("저장 단추가 늘 붙어 있다", () => {
    render(<SketchShowcase year={2026} all={all} written={undefined} onWrite={async () => true} sidoOf={undefined} />);
    expect(screen.getByRole("button", { name: "2026년 이미지 저장" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "스토리용 세로로" })).toBeTruthy();
  });
});

const withPhotos: SketchTrip[] = [
  {
    ...all[0],
    visits: [
      { placeName: "안목해변", spotId: null, lat: 37.77, lng: 128.95, photoCount: 18, dong: null, photoPath: "a.webp" },
      { placeName: "속초해변", spotId: null, lat: 38.19, lng: 128.6, photoCount: 8, dong: null, photoPath: "b.webp" },
    ],
  },
];

const show = (trips: SketchTrip[]) =>
  render(<SketchShowcase year={2026} all={trips} written={undefined} onWrite={async () => true} sidoOf={undefined} />);

/*
  같은 한 해라도 보여 줄 곳에 따라 어울리는 모양이 다르다. 고른 모양
  그대로 보이고, 그대로 저장되고, 다음에 와도 그 모양이어야 한다.
*/
describe("SketchShowcase · 카드 모양", () => {
  beforeEach(() => window.localStorage.clear());

  it("세 모양 가운데 처음에는 지도", () => {
    show(withPhotos);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual(["지도", "사진 콜라주", "선 그림"]);
    expect(screen.getByRole("radio", { name: "지도" }).getAttribute("aria-checked")).toBe("true");
  });

  it("선 그림을 고르면 선 그림 카드가 보이고, 다음에도 기억한다", () => {
    const { unmount } = show(withPhotos);
    fireEvent.click(screen.getByRole("radio", { name: "선 그림" }));
    expect(screen.getByRole("img", { name: /선 그림/ })).toBeTruthy();
    unmount();

    show(withPhotos);
    expect(screen.getByRole("radio", { name: "선 그림" }).getAttribute("aria-checked")).toBe("true");
  });

  it("사진이 있는 해는 콜라주를 고를 수 있다 — 칸마다 그곳 여행으로 이어진다", () => {
    show(withPhotos);
    fireEvent.click(screen.getByRole("radio", { name: "사진 콜라주" }));
    expect(screen.getByRole("img", { name: /사진 콜라주, 안목해변, 속초해변/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "안목해변 여행 열기" }).getAttribute("href")).toBe("/trips/t1");
  });

  it("사진이 없는 해는 콜라주를 고를 수 없다", () => {
    show(all);
    expect((screen.getByRole("radio", { name: "사진 콜라주" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("콜라주를 골라 뒀어도 사진이 없는 해는 지도로 보이고 그 까닭을 말한다", () => {
    window.localStorage.setItem("sketch:cardStyle", "collage");
    show(all);
    expect(screen.getByRole("radio", { name: "지도" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("이 해에는 올린 사진이 없어 지도로 보여 드려요.")).toBeTruthy();
  });
});
