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

// Kakao's stock blue pin doesn't match the app's dark-premium palette at
// all, so the marker below is custom-colored to match --color-accent. This
// SVG renders as a standalone data URI — a separate document context that
// can't see the page's CSS custom properties — so the hex value is
// duplicated here rather than referenced via var().

// A small solid-blue circle with a white ring, used for both the
// single-spot close-up view (the detail page) and the many-spot overview
// (the home page) — a small, unobtrusive dot reads better at any zoom than
// a larger pin shape. The white ring stays white regardless of the app's
// theme: it exists purely for contrast against the map's own light-colored
// tiles, which Kakao renders independently of the surrounding UI.
function buildMarkerImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="7" fill="#0071E3" stroke="white" stroke-width="2"/></svg>`;
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
    "max-w-[240px] rounded-xl bg-surface p-3 text-sm shadow-[0_4px_16px_rgba(0,0,0,0.16)] ring-1 ring-line";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "×";
  closeButton.className =
    "float-right -mt-1 -mr-1 rounded px-1 text-text-faint hover:text-text";
  closeButton.addEventListener("click", onClose);
  container.appendChild(closeButton);

  const name = document.createElement("h4");
  name.textContent = spot.name;
  name.className = "text-[15px] font-semibold tracking-tight text-text";
  container.appendChild(name);

  const summary = document.createElement("p");
  summary.textContent =
    spot.summary.length > 50 ? `${spot.summary.slice(0, 50)}…` : spot.summary;
  summary.className = "mt-1 text-[13px] leading-relaxed text-text-muted";
  container.appendChild(summary);

  const tags = document.createElement("div");
  tags.className = "mt-2 flex flex-wrap gap-1";
  spot.seasons.forEach((season) => {
    const tag = document.createElement("span");
    tag.textContent = season;
    tag.className = "rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent";
    tags.appendChild(tag);
  });
  spot.foods.forEach((food) => {
    const tag = document.createElement("span");
    tag.textContent = food;
    tag.className = "rounded-md bg-bg-subtle px-2 py-0.5 text-[11px] text-text-muted";
    tags.appendChild(tag);
  });
  container.appendChild(tags);

  const link = document.createElement("a");
  link.href = `/spots/${spot.id}`;
  link.textContent = "자세히 보기 →";
  link.className =
    "mt-2 inline-block text-[13px] font-medium text-accent hover:text-accent-hover";
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

    // Built once and reused across every marker below — all markers in a
    // given render share the same icon, so there's no reason to construct
    // a fresh MarkerImage (and re-encode the same SVG data URI) per spot.
    const markerImage = buildMarkerImage();

    spots.forEach((spot) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(spot.lat, spot.lng),
        map: mapRef.current,
        image: markerImage,
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

  // Clears markers/overlay on cleanup, but deliberately does NOT reset
  // `mapRef.current` here. In dev, React Strict Mode mounts every component
  // twice (mount → cleanup → mount) to surface exactly this kind of bug.
  // Once this script src is cached, `<Script onReady>` fires synchronously
  // on both mount passes (see the comment below), so if cleanup nulled
  // `mapRef.current`, the second pass's `initMap` guard would see it as
  // unset and construct a SECOND `kakao.maps.Map` on the same container —
  // two independent map instances racing to own one DOM node, and whichever
  // one loses ends up with markers added to a map that's no longer the one
  // actually attached/visible, so nothing appears. Leaving `mapRef.current`
  // alone across cleanup makes the second pass's `initMap` a no-op (guard
  // sees a map already exists) while the `[spots]` effect below still
  // re-populates markers on that one surviving map instance. A genuine new
  // mount (a different component instance entirely) is unaffected — it
  // gets its own fresh `useRef(null)` regardless of what this cleanup does.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((marker) => marker.setMap(null));
      markers.clear();
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
    };
  }, []);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-bg-subtle p-4 text-center text-sm text-text-faint">
        지도를 보려면 카카오맵 키 설정이 필요합니다
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center bg-bg-subtle p-4 text-center text-sm text-text-faint">
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
