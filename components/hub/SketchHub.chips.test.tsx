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

/*
  로그인 전 사람이 "내 여행"을 눌러 처음 보는 시트. 첫 화면의 환영 영역과 같은 약속을 하고 같은 단추(사진 고르기)를
  앞세운다 — 로그인하라는 말부터 들으면 빈 벽이다. 사진 고르기는 로그인 없이 시작할 수 있고, 로그인은 기록으로
  남길 때 하면 된다.
*/
describe("HubView · 로그인 전 시트", () => {
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

  const openGuest = () =>
    render(
      <HubView
        status="guest"
        userId={null}
        trips={[]}
        places={[]}
        pinUrls={new Map()}
        returnTrip={null}
        switcher={<span>갈래 스위치</span>}
      />,
    );

  it("무엇이 되는지 한 줄로 말한다", () => {
    openGuest();
    expect(screen.getByText("다녀온 곳이 이 지도에 사진으로 찍혀요")).toBeTruthy();
    expect(screen.getByText("사진을 고르면 언제 어디서 찍었는지 읽어 지도에 얹어 드려요.")).toBeTruthy();
  });

  it("앞세운 단추는 '사진 고르기' — 로그인 없이 시작한다", () => {
    openGuest();
    const pick = screen.getByRole("link", { name: "사진 고르기" });
    expect(pick).toHaveAttribute("href", "/trips/new");
    expect(pick.className).toContain("bg-accent");
  });

  it("로그인은 작은 링크로 곁에 둔다 — 돌아올 곳은 내 여행", () => {
    openGuest();
    const login = screen.getByRole("link", { name: "로그인" });
    expect(login.getAttribute("href")).toBe("/login?next=%2F%3Fv%3Dsketch");
    expect(login.className).not.toContain("bg-accent");
  });

  it("로그인부터 하라고 말하지 않는다", () => {
    const { container } = openGuest();
    expect(container.textContent).not.toContain("로그인하고 사진을 고르면");
    expect(screen.queryByRole("link", { name: "로그인하기" })).toBeNull();
  });
});
