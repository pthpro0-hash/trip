import { describe, it, expect, vi } from "vitest";
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
