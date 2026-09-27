import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { HubPlace } from "@/lib/hub";
import type { HubMapHandle } from "./HubMap";

vi.mock("@/lib/supabase/client", () => ({ getBrowserClient: () => null }));

const { ReplayPanel } = await import("./ReplayPanel");

/*
  다시 걷기는 시간이 흐르며 일어나는 일이라 눈으로 읽어서는 순서가
  맞는지 모른다. 가짜 지도와 가짜 시계로 한 걸음씩 짚어 본다.
*/
const place = (id: string, startedAt: string, lat: number): HubPlace => ({
  visitId: id,
  tripId: "t1",
  tripLabel: "강릉 1박 2일",
  placeName: `곳 ${id}`,
  lat,
  lng: 128.9,
  startedAt,
  photoCount: 3,
  coverPath: null,
});

const stops = [
  place("a", "2026-09-13 09:00:00", 38.4),
  place("b", "2026-09-13 15:00:00", 38.0),
  place("c", "2026-09-14 06:00:00", 37.7),
];

function 가짜지도() {
  return {
    frame: vi.fn(),
    trail: vi.fn(),
    grow: vi.fn(() => Promise.resolve()),
    clearTrail: vi.fn(),
  } satisfies HubMapHandle;
}

/** 머무는 시간을 지나 다음 걸음으로. 선 늘이기(약속)가 풀릴 틈도 준다. */
async function 한걸음() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    vi.advanceTimersByTime(3000);
  });
}

describe("ReplayPanel · 걷기", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("첫 곳에 서고, 다음 곳마다 앞의 곳에서 선을 늘인다", async () => {
    const map = 가짜지도();
    const onAt = vi.fn();
    render(<ReplayPanel userId="나" stops={stops} map={{ current: map }} onAt={onAt} onClose={() => {}} />);

    expect(screen.getByText("곳 a")).toBeTruthy();
    expect(map.trail).toHaveBeenCalledWith([[stops[0]]]);
    expect(onAt).toHaveBeenLastCalledWith(stops[0]);

    await 한걸음();
    expect(screen.getByText("곳 b")).toBeTruthy();
    // 두 곳이 다 들어오게 맞추고, a 끝에서 b 까지 늘인다.
    expect(map.frame).toHaveBeenLastCalledWith([stops[0], stops[1]]);
    expect(map.grow).toHaveBeenLastCalledWith([[{ lat: 38.4, lng: 128.9 }]], stops[1], expect.any(Number));
  });

  it("여행이 바뀌면 선을 잇지 않고 새 토막을 시작한다", async () => {
    const map = 가짜지도();
    const 두여행 = [stops[0], { ...stops[1], tripId: "t2", tripLabel: "대천 당일" }];
    render(<ReplayPanel userId="나" stops={두여행} map={{ current: map }} onAt={() => {}} onClose={() => {}} />);

    await 한걸음();
    // 늘이지 않는다. 앞 여행 토막은 그대로 두고 새 토막을 한 점으로 시작한다.
    expect(map.grow).not.toHaveBeenCalled();
    expect(map.trail).toHaveBeenLastCalledWith([[{ lat: 38.4, lng: 128.9 }], [두여행[1]]]);
    expect(screen.getByText("대천 당일")).toBeTruthy();
  });

  it("멈추면 그 자리에 머문다", async () => {
    const map = 가짜지도();
    render(<ReplayPanel userId="나" stops={stops} map={{ current: map }} onAt={() => {}} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /멈춤/ }));
    await 한걸음();
    await 한걸음();
    expect(screen.getByText("곳 a")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /계속/ }));
    await 한걸음();
    expect(screen.getByText("곳 b")).toBeTruthy();
  });

  it("다음을 누르면 기다리지 않고 넘어간다", () => {
    const map = 가짜지도();
    render(<ReplayPanel userId="나" stops={stops} map={{ current: map }} onAt={() => {}} onClose={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByText("곳 b")).toBeTruthy();
  });

  it("다 걸으면 걸은 길 전체로 물러서고, 처음부터 다시 걸을 수 있다", async () => {
    const map = 가짜지도();
    const onAt = vi.fn();
    render(<ReplayPanel userId="나" stops={stops} map={{ current: map }} onAt={onAt} onClose={() => {}} />);

    await 한걸음();
    await 한걸음();
    await 한걸음();

    expect(screen.getByText("다 걸었어요")).toBeTruthy();
    expect(map.frame).toHaveBeenLastCalledWith(stops);
    expect(onAt).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: /처음부터/ }));
    expect(map.clearTrail).toHaveBeenCalled();
    expect(screen.getByText("곳 a")).toBeTruthy();
  });

  it("움직임을 줄여 달라고 했으면 선을 늘이지 않고 곧장 긋는다", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const map = 가짜지도();
    render(<ReplayPanel userId="나" stops={stops} map={{ current: map }} onAt={() => {}} onClose={() => {}} />);

    await 한걸음();
    expect(map.grow).toHaveBeenLastCalledWith(expect.anything(), stops[1], 0);
  });

  it("닫기를 누르면 알린다", () => {
    const onClose = vi.fn();
    render(<ReplayPanel userId="나" stops={stops} map={{ current: 가짜지도() }} onAt={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onClose).toHaveBeenCalled();
  });
});
