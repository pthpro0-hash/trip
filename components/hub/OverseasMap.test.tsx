import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { HubPlace } from "@/lib/hub";

/*
  해외 곳을 보는 지도 — 실제 지도 라이브러리는 브라우저가 필요해 가짜로 바꿔, 핀을 얹는 것·범위를 알리는 것·곳을 맞추는 것만 본다.
*/
const calls = vi.hoisted(() => ({ markers: [] as { latlng: number[]; html: HTMLElement }[], fit: [] as unknown[], view: [] as unknown[], removed: 0 }));

vi.mock("leaflet/dist/leaflet.css", () => ({}));
vi.mock("leaflet", () => {
  const map = {
    on: vi.fn(),
    remove: () => (calls.removed += 1),
    fitBounds: (...args: unknown[]) => calls.fit.push(args),
    setView: (...args: unknown[]) => calls.fit.push(args),
    latLngToContainerPoint: ([lat, lng]: number[]) => ({ x: lng * 10 + 100, y: lat * 10 + 100 }),
    containerPointToLatLng: ([x, y]: number[]) => ({ lat: y, lng: x }),
    getSize: () => ({ x: 800, y: 600 }),
  };
  const lib = {
    map: () => map,
    tileLayer: () => ({ addTo: () => undefined }),
    control: { attribution: () => ({ addTo: () => undefined }) },
    latLngBounds: (points: unknown) => points,
    divIcon: (options: { html: HTMLElement }) => options,
    marker: (latlng: number[], options: { icon: { html: HTMLElement } }) => {
      const entry = { latlng, html: options.icon.html };
      const marker = {
        // 실제 라이브러리처럼 자기 자신을 돌려준다. 걷어 낸 핀은 지도에서 빠진다.
        addTo: () => (calls.markers.push(entry), marker),
        remove: () => void (calls.markers = calls.markers.filter((item) => item !== entry)),
      };
      return marker;
    },
  };
  return { default: lib };
});
const { OverseasMap } = await import("./OverseasMap");

const place = (id: string, lat: number, lng: number, over: Partial<HubPlace> = {}): HubPlace => ({
  visitId: id, tripId: "t", tripTitle: "도쿄", placeName: `곳${id}`, spotId: null, lat, lng, photoCount: 3, startedOn: "2026-05-01", coverPath: null, ...over,
} as HubPlace);

beforeEach(() => {
  calls.markers = [];
  calls.fit = [];
  calls.view = [];
  calls.removed = 0;
});

const props = (places: HubPlace[], onView = vi.fn()) => ({
  places, photoUrls: new Map<string, string>(), pickedIds: new Set<string>(), flyTo: null, bottomInset: 100, onView, onPick: vi.fn(),
});

describe("OverseasMap", () => {
  it("해외 곳마다 핀을 얹고, 곳들이 다 들어오게 맞춘다", async () => {
    const onView = vi.fn();
    render(<OverseasMap {...props([place("a", 10, 10), place("b", 30, 40)], onView)} />);
    await waitFor(() => expect(calls.markers.length).toBe(2));
    expect(calls.fit.length).toBeGreaterThan(0);
    // 시트가 덮은 아래를 뺀 범위를 알린다.
    expect(onView).toHaveBeenCalled();
    expect(onView.mock.calls[0][0]).toEqual(expect.objectContaining({ south: expect.any(Number), north: expect.any(Number) }));
  });

  it("핀은 곳의 이름과 사진 수를 이름표로 가진다", async () => {
    render(<OverseasMap {...props([place("a", 10, 10)])} />);
    await waitFor(() => expect(calls.markers.length).toBe(1));
    expect(calls.markers[0].html.querySelector("button")?.getAttribute("aria-label")).toBe("곳a, 사진 3장");
  });

  it("떠날 때 지도를 거둔다", async () => {
    const view = render(<OverseasMap {...props([place("a", 10, 10)])} />);
    await waitFor(() => expect(calls.markers.length).toBe(1));
    view.unmount();
    expect(calls.removed).toBe(1);
  });
});
