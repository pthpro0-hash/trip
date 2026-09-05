"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import type { Spot } from "@/lib/types";
import { buildKakaoScriptSrc } from "@/lib/kakao";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
    kakao: any;
  }
}

interface KakaoMapProps {
  spots: Spot[];
  selectedId?: string;
  onMarkerClick?: (id: string) => void;
}

// next/script caches a script src's load promise even after a load failure
// (its internal .catch() swallows the rejection into a resolved promise), so
// a remount after a first-mount failure gets onLoad instead of onError and
// never learns the script actually failed. Tracking failures here at module
// scope lets a remount within the same page session immediately show the
// error fallback instead of waiting for an onError that will never come.
const failedScriptSrcs = new Set<string>();

// A small solid-blue circle with a white ring, matching the app's existing
// blue accent color (see SpotCard.tsx's season tag). Used instead of the
// default Kakao pin when only a single spot is shown (the detail page).
function buildSmallMarkerImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="#2563eb" stroke="white" stroke-width="2"/></svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return new window.kakao.maps.MarkerImage(
    src,
    new window.kakao.maps.Size(18, 18),
    { offset: new window.kakao.maps.Point(9, 9) },
  );
}

// Builds the marker-click popup content via safe DOM construction (no
// innerHTML) so spot data is never interpreted as markup, reusing the
// Tailwind visual language established by SpotCard.tsx.
function buildOverlayContent(spot: Spot, onClose: () => void): HTMLElement {
  const container = document.createElement("div");
  container.className =
    "max-w-[240px] rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-lg";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.className =
    "float-right -mt-1 -mr-1 rounded px-1 text-neutral-400 hover:text-neutral-700";
  closeButton.addEventListener("click", onClose);
  container.appendChild(closeButton);

  const name = document.createElement("h4");
  name.textContent = spot.name;
  name.className = "font-semibold text-base text-neutral-900";
  container.appendChild(name);

  const summary = document.createElement("p");
  summary.textContent =
    spot.summary.length > 50 ? `${spot.summary.slice(0, 50)}…` : spot.summary;
  summary.className = "mt-1 text-neutral-600";
  container.appendChild(summary);

  const tags = document.createElement("div");
  tags.className = "mt-2 flex flex-wrap gap-1";
  spot.seasons.forEach((season) => {
    const tag = document.createElement("span");
    tag.textContent = season;
    tag.className = "rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700";
    tags.appendChild(tag);
  });
  spot.foods.forEach((food) => {
    const tag = document.createElement("span");
    tag.textContent = food;
    tag.className = "rounded bg-orange-50 px-2 py-0.5 text-xs text-orange-700";
    tags.appendChild(tag);
  });
  container.appendChild(tags);

  const link = document.createElement("a");
  link.href = `/spots/${spot.id}`;
  link.textContent = "자세히 보기 →";
  link.className = "mt-2 inline-block font-medium text-blue-600 hover:underline";
  container.appendChild(link);

  return container;
}

export function KakaoMap({ spots, selectedId, onMarkerClick }: KakaoMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const scriptSrc = buildKakaoScriptSrc(apiKey);

  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const markersRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const overlayRef = useRef<any>(null);
  // Marker click handlers are (re)created only when `spots` changes (see
  // renderMarkers below), so they'd otherwise close over a stale React state
  // value across repeated clicks. This ref always holds the current value and
  // drives the toggle decision; the state below mirrors it for consumers that
  // need to react to which popup is open.
  const openOverlayIdRef = useRef<string | null>(null);
  const [, setOpenOverlayId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(() => failedScriptSrcs.has(scriptSrc));

  const closeOverlay = () => {
    overlayRef.current?.setMap(null);
    overlayRef.current = null;
    openOverlayIdRef.current = null;
    setOpenOverlayId(null);
  };

  const openOverlayForSpot = (spot: Spot) => {
    closeOverlay();
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(spot.lat, spot.lng),
      content: buildOverlayContent(spot, closeOverlay),
      xAnchor: 0.5,
      yAnchor: 1.2,
      zIndex: 10,
    });
    overlay.setMap(mapRef.current);
    overlayRef.current = overlay;
    openOverlayIdRef.current = spot.id;
    setOpenOverlayId(spot.id);
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.kakao) return;
    closeOverlay();
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    const isSingleSpot = spots.length === 1;

    spots.forEach((spot) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(spot.lat, spot.lng),
        map: mapRef.current,
        image: isSingleSpot ? buildSmallMarkerImage() : undefined,
      });
      window.kakao.maps.event.addListener(marker, "click", () => {
        onMarkerClick?.(spot.id);
        if (openOverlayIdRef.current === spot.id) {
          closeOverlay();
        } else {
          openOverlayForSpot(spot);
        }
      });
      markersRef.current.set(spot.id, marker);
    });
  };

  const initMap = () => {
    // Guard against double-initialization: onReady can fire again on this
    // mount (e.g. React strict-mode double effect) even when a map instance
    // already exists for it.
    if (mapRef.current || !containerRef.current || !window.kakao) return;
    window.kakao.maps.load(() => {
      // A single spot (the detail page) gets a close-up view centered on it;
      // the full list (the home page) keeps the whole-country overview.
      const isSingleSpot = spots.length === 1;
      const center = isSingleSpot
        ? new window.kakao.maps.LatLng(spots[0].lat, spots[0].lng)
        : new window.kakao.maps.LatLng(36.5, 127.8);
      const level = isSingleSpot ? 4 : 13;

      const map = new window.kakao.maps.Map(containerRef.current, { center, level });
      mapRef.current = map;
      renderMarkers();
    });
  };

  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  useEffect(() => {
    if (!selectedId || !mapRef.current || !window.kakao) return;
    const spot = spots.find((s) => s.id === selectedId);
    if (spot) {
      mapRef.current.panTo(new window.kakao.maps.LatLng(spot.lat, spot.lng));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // next/script's LoadCache is keyed by script src, so the script's `load`
  // event (and therefore onLoad) only ever fires once per src for the whole
  // page. Every remount of this component starts from a clean slate here so
  // a later onReady-driven re-init always builds a fresh map instance.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      markers.clear();
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      mapRef.current = null;
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
        지도를 보려면 카카오맵 키 설정이 필요합니다
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
        지도를 불러오지 못했습니다
      </div>
    );
  }

  return (
    <>
      {/*
        onReady (not onLoad) is required here: next/script's LoadCache means
        the `load` event that drives onLoad only fires the first time this
        script src loads on the page. onReady is re-invoked by next/script on
        every mount, including when the script is already cached from a prior
        mount, so it is the only callback that reliably fires on remount.
      */}
      <Script
        src={scriptSrc}
        strategy="afterInteractive"
        onReady={initMap}
        onError={() => {
          failedScriptSrcs.add(scriptSrc);
          setHasError(true);
        }}
      />
      <div ref={containerRef} className="h-full min-h-[400px] w-full" />
    </>
  );
}
