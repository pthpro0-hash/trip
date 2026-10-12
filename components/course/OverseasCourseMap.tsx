"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { OSM_ATTRIBUTION, OSM_TILE_URL } from "@/lib/osmTiles";
import type { MapStop } from "./CourseMap";

/*
  해외에서 다녀온 여행의 코스 지도 — 카카오 지도(CourseMap)는 한국 밖에 그림이 없어 하얗게 비므로 OpenStreetMap 바탕으로 그린다.
  모양은 같다: 들른 차례대로 번호 표식을 찍고 선으로 잇는다.
*/
const LINE_COLOR = "#0071E3";
const PADDING = 28;
const SOLO_ZOOM = 15;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet 은 동적으로 불러와 형을 느슨하게 둔다
type Leaflet = any;

export function OverseasCourseMap({ spots, connect = true }: { spots: MapStop[]; connect?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // 부르는 쪽이 그릴 때마다 같은 값의 새 배열을 건네므로, 내용이 바뀔 때만 지도를 새로 세운다.
  const key = spots.map((spot) => `${spot.lat},${spot.lng},${spot.name}`).join("|");
  const latest = useRef(spots);
  useEffect(() => {
    latest.current = spots;
  });

  useEffect(() => {
    const spotList = latest.current;
    let cancelled = false;
    let map: Leaflet = null;

    import("leaflet")
      .then((module) => {
        if (cancelled || !boxRef.current) return;
        const L: Leaflet = module.default ?? module;
        map = L.map(boxRef.current, { zoomControl: false, attributionControl: false });
        L.tileLayer(OSM_TILE_URL, { maxZoom: 18, attribution: OSM_ATTRIBUTION }).addTo(map);
        L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

        const points = spotList.map((spot) => [spot.lat, spot.lng]);
        if (connect && points.length > 1) L.polyline(points, { color: LINE_COLOR, weight: 4, opacity: 0.85 }).addTo(map);

        spotList.forEach((spot, index) => {
          const mark = document.createElement("span");
          mark.textContent = String(index + 1);
          mark.setAttribute("role", "img");
          mark.setAttribute("aria-label", `${index + 1}. ${spot.name}`);
          Object.assign(mark.style, {
            display: "grid",
            placeItems: "center",
            width: "31px",
            height: "31px",
            borderRadius: "999px",
            background: LINE_COLOR,
            color: "#ffffff",
            border: "2.5px solid #ffffff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            fontSize: "14px",
            fontWeight: "700",
            transform: "translate(-50%, -50%)",
            position: "absolute",
          });
          L.marker([spot.lat, spot.lng], { icon: L.divIcon({ html: mark, className: "", iconSize: [0, 0] }), keyboard: false }).addTo(map);
        });

        if (points.length === 1) map.setView(points[0], SOLO_ZOOM);
        else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [PADDING, PADDING] });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [key, connect]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-bg-subtle p-6 text-center text-[14px] text-text-muted">
        지도를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
      </div>
    );
  }
  return <div ref={boxRef} className="h-full w-full" aria-label="코스 지도" role="application" />;
}
