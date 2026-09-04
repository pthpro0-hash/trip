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

export function KakaoMap({ spots, selectedId, onMarkerClick }: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const markersRef = useRef<Map<string, any>>(new Map());
  const [hasError, setHasError] = useState(false);

  const renderMarkers = () => {
    if (!mapRef.current || !window.kakao) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current.clear();

    spots.forEach((spot) => {
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(spot.lat, spot.lng),
        map: mapRef.current,
      });
      window.kakao.maps.event.addListener(marker, "click", () => {
        onMarkerClick?.(spot.id);
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
      const map = new window.kakao.maps.Map(containerRef.current, {
        center: new window.kakao.maps.LatLng(36.5, 127.8),
        level: 13,
      });
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
      mapRef.current = null;
    };
  }, []);

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

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
        src={buildKakaoScriptSrc(apiKey)}
        strategy="afterInteractive"
        onReady={initMap}
        onError={() => setHasError(true)}
      />
      <div ref={containerRef} className="h-full min-h-[400px] w-full" />
    </>
  );
}
