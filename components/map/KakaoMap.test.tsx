import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ScriptProps } from "next/script";
import { KakaoMap } from "./KakaoMap";
import type { Spot } from "@/lib/types";

const SPOT: Spot = {
  id: "gyeongbokgung",
  name: "경복궁",
  region: "수도권",
  lat: 37.5796,
  lng: 126.977,
  summary: "",
  highlights: ["근정전"],
  seasons: ["봄"],
  specialty: [],
  foods: ["설렁탕", "왕갈비"],
  themes: ["역사유적"],
};

// initMap only touches window.kakao inside window.kakao.maps.load's callback,
// so a fake that runs the callback synchronously and records what Map() was
// constructed with is enough to assert on center/level without a real SDK.
function stubKakao() {
  const mapCalls: { center: { lat: number; lng: number }; level: number }[] = [];
  const markerCalls: { position: { lat: number; lng: number }; image?: unknown }[] = [];
  const overlayCalls: {
    position: { lat: number; lng: number };
    content: HTMLElement;
    setMapCalls: unknown[];
  }[] = [];
  // Marker click listeners registered via event.addListener, keyed by the
  // marker object they were registered on, so tests can invoke them directly.
  const markerListeners = new Map<unknown, () => void>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub mirrors the untyped Kakao SDK
  (window as any).kakao = {
    maps: {
      load: (cb: () => void) => cb(),
      // `new window.kakao.maps.LatLng(...)` requires a real constructor —
      // an arrow function can't be called with `new`, so these must be
      // ordinary functions.
      LatLng: function (lat: number, lng: number) {
        return { lat, lng };
      },
      Map: function (
        _el: unknown,
        options: { center: { lat: number; lng: number }; level: number },
      ) {
        mapCalls.push(options);
        return {};
      },
      Marker: function (options: { position: { lat: number; lng: number }; image?: unknown }) {
        markerCalls.push(options);
        const marker = { setMap: () => {} };
        return marker;
      },
      MarkerImage: function (src: string, size: unknown, opts: unknown) {
        return { src, size, opts };
      },
      Size: function (width: number, height: number) {
        return { width, height };
      },
      Point: function (x: number, y: number) {
        return { x, y };
      },
      CustomOverlay: function (options: {
        position: { lat: number; lng: number };
        content: HTMLElement;
      }) {
        const setMapCalls: unknown[] = [];
        const overlay = {
          ...options,
          setMap: (map: unknown) => setMapCalls.push(map),
        };
        overlayCalls.push({ ...options, setMapCalls });
        return overlay;
      },
      event: {
        addListener: (marker: unknown, _event: string, cb: () => void) => {
          markerListeners.set(marker, cb);
        },
      },
    },
  };
  return { mapCalls, markerCalls, overlayCalls, markerListeners };
}

// next/script renders a real <script> tag and relies on browser load/error
// events that jsdom never fires, so we stub it to capture the props this
// component passes in (onReady/onError) and let tests invoke them directly.
let scriptProps: ScriptProps[] = [];

vi.mock("next/script", () => ({
  default: (props: ScriptProps) => {
    scriptProps.push(props);
    return null;
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  scriptProps = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test stub mirrors the untyped Kakao SDK
  delete (window as any).kakao;
});

describe("KakaoMap", () => {
  it("window.kakao가 없어도 컨테이너를 렌더링한다 (SSR/로딩 전 안전성)", () => {
    const { container } = render(<KakaoMap spots={[]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("API 키가 없으면 안내 메시지를 표시한다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "");
    const { getByText } = render(<KakaoMap spots={[]} />);
    expect(getByText("지도를 보려면 카카오맵 키 설정이 필요합니다")).toBeTruthy();
  });

  it("스크립트 로딩 실패 후 재마운트해도 실패 안내가 onError 없이 즉시 표시된다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "remount-test-key");

    const { unmount } = render(<KakaoMap spots={[]} />);
    const firstMountProps = scriptProps.at(-1);
    expect(firstMountProps?.onError).toBeTypeOf("function");

    // Simulate next/script's onError firing on the first mount.
    act(() => {
      firstMountProps?.onError?.(new Event("error"));
    });
    expect(screen.getByText("지도를 불러오지 못했습니다")).toBeTruthy();

    // Unmount and mount a brand-new instance without ever calling onError
    // again. next/script's own cache would replay onLoad here (the bug this
    // fix addresses), so the fallback must appear purely from the module
    // scope failure tracking, not from another onError call.
    unmount();
    scriptProps = [];

    render(<KakaoMap spots={[]} />);
    expect(screen.getByText("지도를 불러오지 못했습니다")).toBeTruthy();
  });

  it("관광지가 1곳이면 그 위치로 클로즈업해서 초기화한다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "single-spot-key");
    const { mapCalls } = stubKakao();

    render(<KakaoMap spots={[SPOT]} />);
    act(() => {
      scriptProps.at(-1)?.onReady?.();
    });

    expect(mapCalls).toHaveLength(1);
    expect(mapCalls[0]).toEqual({ center: { lat: SPOT.lat, lng: SPOT.lng }, level: 4 });
  });

  it("관광지가 여러 곳이면 전국이 보이는 기본 뷰로 초기화한다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "multi-spot-key");
    const { mapCalls } = stubKakao();

    render(<KakaoMap spots={[SPOT, { ...SPOT, id: "changdeokgung" }]} />);
    act(() => {
      scriptProps.at(-1)?.onReady?.();
    });

    expect(mapCalls).toHaveLength(1);
    expect(mapCalls[0]).toEqual({ center: { lat: 36.5, lng: 127.8 }, level: 13 });
  });

  it("관광지가 1곳이면 작은 마커 이미지를 사용한다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "single-marker-key");
    const { markerCalls } = stubKakao();

    render(<KakaoMap spots={[SPOT]} />);
    act(() => {
      scriptProps.at(-1)?.onReady?.();
    });

    expect(markerCalls).toHaveLength(1);
    expect(markerCalls[0].image).toBeTruthy();
  });

  it("관광지가 여러 곳이면 골드 핀 마커 이미지를 사용한다(단일 지점의 작은 원과는 다른 모양)", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "multi-marker-key");
    const { markerCalls } = stubKakao();

    render(<KakaoMap spots={[SPOT, { ...SPOT, id: "changdeokgung" }]} />);
    act(() => {
      scriptProps.at(-1)?.onReady?.();
    });

    expect(markerCalls).toHaveLength(2);
    // Both markers share one built-once image (not undefined, and not the
    // 18x18 single-spot circle) — a distinct, larger teardrop pin shape.
    expect(markerCalls[0].image).toBeTruthy();
    expect(markerCalls[0].image).toBe(markerCalls[1].image);
    expect(markerCalls[0].image.size).not.toEqual({ width: 18, height: 18 });
  });

  it("마커를 클릭하면 해당 위치에 CustomOverlay 팝업이 열린다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "overlay-open-key");
    const { overlayCalls, markerListeners } = stubKakao();

    render(<KakaoMap spots={[SPOT]} />);
    act(() => {
      scriptProps.at(-1)?.onReady?.();
    });

    const [marker] = markerListeners.keys();
    act(() => {
      markerListeners.get(marker)?.();
    });

    expect(overlayCalls).toHaveLength(1);
    expect(overlayCalls[0].position).toEqual({ lat: SPOT.lat, lng: SPOT.lng });
    expect(overlayCalls[0].content.textContent).toContain(SPOT.name);
  });

  it("같은 마커를 다시 클릭하면 팝업이 닫힌다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "overlay-toggle-key");
    const { overlayCalls, markerListeners } = stubKakao();

    render(<KakaoMap spots={[SPOT]} />);
    act(() => {
      scriptProps.at(-1)?.onReady?.();
    });

    const [marker] = markerListeners.keys();
    act(() => {
      markerListeners.get(marker)?.();
    });
    act(() => {
      markerListeners.get(marker)?.();
    });

    expect(overlayCalls).toHaveLength(1);
    expect(overlayCalls[0].setMapCalls).toContain(null);
  });
});
