"use client";

import { useEffect, useRef } from "react";
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
    if (!containerRef.current || !window.kakao) return;
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

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

  return (
    <>
      <Script src={buildKakaoScriptSrc(apiKey)} strategy="afterInteractive" onLoad={initMap} />
      <div ref={containerRef} className="h-full min-h-[400px] w-full" />
    </>
  );
}
