"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";

/*
  지도에 순서대로 찍을 지점. 여행지(Spot)도 방문 기록도 이 모양을 갖추면
  그대로 쓸 수 있어, 같은 지도를 두 벌 만들지 않아도 된다.
*/
export interface MapStop {
  lat: number;
  lng: number;
  name: string;
}

interface CourseMapProps {
  spots: MapStop[];
}

const LINE_COLOR = "#0071E3";
const BOUNDS_PADDING = 40;
const MARKER_SIZE = 31; // 기존 26에서 한 단계 키웠다 — 순번이 또렷해야 목록과 이어 읽힌다.

// 지도 위에 순번을 그대로 얹어야 목록의 1·2·3과 눈으로 이어진다.
// 데이터 URI 안의 SVG는 페이지 CSS 변수를 볼 수 없어 색을 직접 적는다.
function numberedMarkerImage(order: number) {
  const center = MARKER_SIZE / 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_SIZE}" height="${MARKER_SIZE}">` +
    `<circle cx="${center}" cy="${center}" r="13.2" fill="${LINE_COLOR}" stroke="white" stroke-width="2.4"/>` +
    `<text x="${center}" y="${center + 5.4}" text-anchor="middle" font-size="14.4" font-weight="700"` +
    ` font-family="-apple-system, BlinkMacSystemFont, sans-serif" fill="white">${order}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function CourseMap({ spots }: CourseMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
  const drawnRef = useRef<any[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!apiKey || spots.length === 0) return;
    let cancelled = false;

    loadKakaoMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
        const kakao = (window as any).kakao;

        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(containerRef.current, {
            center: new kakao.maps.LatLng(spots[0].lat, spots[0].lng),
            level: 10,
          });
        }
        const map = mapRef.current;

        drawnRef.current.forEach((drawn) => drawn.setMap(null));
        drawnRef.current = [];

        const path = spots.map((spot) => new kakao.maps.LatLng(spot.lat, spot.lng));

        if (path.length > 1) {
          const line = new kakao.maps.Polyline({
            path,
            strokeWeight: 3,
            strokeColor: LINE_COLOR,
            strokeOpacity: 0.75,
            strokeStyle: "solid",
          });
          line.setMap(map);
          drawnRef.current.push(line);
        }

        spots.forEach((spot, index) => {
          const marker = new kakao.maps.Marker({
            position: path[index],
            map,
            title: spot.name,
            image: new kakao.maps.MarkerImage(
              numberedMarkerImage(index + 1),
              new kakao.maps.Size(MARKER_SIZE, MARKER_SIZE),
              { offset: new kakao.maps.Point(MARKER_SIZE / 2, MARKER_SIZE / 2) },
            ),
          });
          drawnRef.current.push(marker);
        });

        if (path.length > 1) {
          const bounds = new kakao.maps.LatLngBounds();
          path.forEach((point: unknown) => bounds.extend(point));
          map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING);
        } else {
          map.setCenter(path[0]);
          map.setLevel(5);
        }
        // 목록이 길어졌다 짧아지면 컨테이너 높이가 바뀌어 타일이 어긋난다.
        map.relayout();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, spots]);

  useEffect(() => {
    const drawn = drawnRef;
    return () => {
      drawn.current.forEach((item) => item.setMap(null));
      drawn.current = [];
    };
  }, []);

  if (!apiKey || failed) {
    return (
      <div className="flex h-full min-h-[320px] w-full items-center justify-center bg-bg-subtle text-sm text-text-faint">
        지도를 불러오지 못했습니다
      </div>
    );
  }

  return <div ref={containerRef} className="h-full min-h-[320px] w-full" />;
}
