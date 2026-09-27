"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps } from "@/lib/kakaoLoader";
import { groupPins, inseparable, type Bounds, type HubPlace } from "@/lib/hub";

/*
  내 사진이 얹힌 지도.

  핀이 곧 사진이다. 점을 보고 "여기가 어디였지" 하는 대신, 그곳에서 찍은
  사진을 보고 알아본다.

  겹치는 핀은 화면에서 잰 거리로 묶고, 확대하거나 옮길 때마다 다시 묶는다.
  전국을 볼 때는 강원도가 한 장으로 접히고, 동네를 볼 때는 해변 셋이
  따로 선다.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Kakao Maps SDK has no official types
type Kakao = any;

/** 이만큼 가까우면 한 무리로 접는다. 핀 폭(44~52px)과 비슷하게. */
const REACH = 52;
/** 한 곳만 있을 때 이보다 더 당기지 않는다. 동네 골목 하나만 보이면 어디인지 모른다. */
const SOLO_LEVEL = 6;
/** 아무것도 없을 때 보여 줄 곳 — 남한 전체. */
const KOREA = { lat: 36.3, lng: 127.8, level: 13 };
const LINE_COLOR = "#0071E3";
/** 가장자리 여백. 핀이 반쯤 잘리지 않게 핀 크기만큼. */
const EDGE = 36;

export interface FlyTarget {
  /** 같은 곳으로 두 번 날아가도 알아듣도록 매번 바꾼다. */
  key: number;
  places: HubPlace[];
}

interface HubMapProps {
  places: HubPlace[];
  /** 원본 경로 → 핀 사진 주소. */
  photoUrls: Map<string, string>;
  /** 고른 여행의 곳들. 들른 순서대로 선을 잇는다. */
  route: HubPlace[] | null;
  /** 지금 펼쳐 보고 있는 곳들. 핀에 테를 두른다. */
  pickedIds: Set<string>;
  flyTo: FlyTarget | null;
  /** 아래에서 시트가 덮고 있는 높이. 그 밑은 화면이 아니다. */
  bottomInset: number;
  onView: (bounds: Bounds) => void;
  onPick: (places: HubPlace[]) => void;
}

export function HubMap({
  places,
  photoUrls,
  route,
  pickedIds,
  flyTo,
  bottomInset,
  onView,
  onPick,
}: HubMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Kakao>(null);
  const overlaysRef = useRef<Kakao[]>([]);
  const lineRef = useRef<Kakao>(null);
  const [failed, setFailed] = useState(false);

  /*
    지도의 행사(idle)는 한 번 걸어 두고 끝까지 쓴다. 그 안에서 읽는 값이
    처음 그대로 굳지 않도록, 늘 최신 값을 여기서 꺼내 쓴다.
  */
  const latest = useRef({ places, photoUrls, pickedIds, bottomInset, onView, onPick, flyTo });
  useEffect(() => {
    latest.current = { places, photoUrls, pickedIds, bottomInset, onView, onPick, flyTo };
  });

  /** 지금 시트 위로 보이는 땅의 범위. */
  const reportView = () => {
    const map = mapRef.current;
    const box = containerRef.current;
    if (!map || !box) return;
    const kakao: Kakao = (window as Kakao).kakao;
    const projection = map.getProjection();
    const visibleHeight = Math.max(1, box.clientHeight - latest.current.bottomInset);
    const sw = projection.coordsFromContainerPoint(new kakao.maps.Point(0, visibleHeight));
    const ne = projection.coordsFromContainerPoint(new kakao.maps.Point(box.clientWidth, 0));
    latest.current.onView({
      south: sw.getLat(),
      west: sw.getLng(),
      north: ne.getLat(),
      east: ne.getLng(),
    });
  };

  /** 곳들이 다 들어오게 맞춘다. 시트가 덮은 만큼 아래를 비워 둔다. */
  const fit = (targets: HubPlace[]) => {
    const map = mapRef.current;
    if (!map || targets.length === 0) return;
    const kakao: Kakao = (window as Kakao).kakao;

    if (inseparable(targets)) {
      map.setLevel(SOLO_LEVEL);
      map.setCenter(new kakao.maps.LatLng(targets[0].lat, targets[0].lng));
      return;
    }
    const bounds = new kakao.maps.LatLngBounds();
    for (const place of targets) bounds.extend(new kakao.maps.LatLng(place.lat, place.lng));
    map.setBounds(bounds, EDGE, EDGE, EDGE + latest.current.bottomInset, EDGE);
  };

  /** 핀을 다시 묶어 다시 얹는다. */
  const redraw = () => {
    const map = mapRef.current;
    const box = containerRef.current;
    if (!map || !box) return;
    const kakao: Kakao = (window as Kakao).kakao;
    const { places: all, photoUrls: urls, pickedIds: picked } = latest.current;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const projection = map.getProjection();
    const byId = new Map(all.map((place) => [place.visitId, place]));
    const pins = all.map((place) => {
      const point = projection.containerPointFromCoords(new kakao.maps.LatLng(place.lat, place.lng));
      return { id: place.visitId, x: point.x, y: point.y, weight: Math.max(1, place.photoCount) };
    });

    const width = box.clientWidth;
    const height = box.clientHeight;
    for (const group of groupPins(pins, REACH)) {
      // 화면 밖의 무리는 얹지 않는다. 옮기면 다시 묶는다.
      if (group.x < -REACH || group.y < -REACH || group.x > width + REACH || group.y > height + REACH) {
        continue;
      }
      const members = group.ids.map((id) => byId.get(id)!);
      const lead = byId.get(group.lead)!;
      const face = [lead, ...members].find((place) => place.coverPath && urls.get(place.coverPath));
      const photo = face?.coverPath ? urls.get(face.coverPath) : undefined;
      const on = members.some((place) => picked.has(place.visitId));

      const pin = pinElement({ members, lead, photo, photos: group.weight, on });
      pin.addEventListener("click", (event) => {
        event.stopPropagation();
        if (members.length === 1 || inseparable(members)) latest.current.onPick(members);
        else fit(members);
      });

      overlaysRef.current.push(
        new kakao.maps.CustomOverlay({
          map,
          position: new kakao.maps.LatLng(lead.lat, lead.lng),
          content: pin,
          xAnchor: 0.5,
          yAnchor: 0.5,
          // 사진이 많은 무리가 위로 온다.
          zIndex: on ? 10_000 : Math.min(9_999, group.weight),
          clickable: true,
        }),
      );
    }
  };

  // 처음 한 번: 지도를 세우고 모든 곳이 들어오게 맞춘다.
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    loadKakaoMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const kakao: Kakao = (window as Kakao).kakao;
        const map = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(KOREA.lat, KOREA.lng),
          level: KOREA.level,
        });
        mapRef.current = map;

        /*
          멈춘 뒤에 읽는다. 확대 직후에 읽은 범위는 아직 이전 값이다 —
          한 번 물려서 핀이 잘린 적이 있다.
        */
        kakao.maps.event.addListener(map, "idle", () => {
          redraw();
          reportView();
        });

        /*
          처음 맞출 곳. 날아가 달라는 곳이 먼저 와 있으면 그리로 — 상세에서
          돌아온 사람은 보던 여행 앞에 서야 한다. 지도는 늦게 서므로, 그
          사이에 온 부탁을 여기서 받는다.
        */
        const start = latest.current.flyTo?.places ?? latest.current.places;
        if (start.length > 0) fit(start);
        redraw();
        reportView();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // 지도는 한 번만 세운다. 나머지는 아래 효과들이 맞춘다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // 곳이 새로 오거나 사진 주소가 도착하면 다시 얹는다.
  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, photoUrls, pickedIds]);

  // 고른 여행을 들른 순서대로 잇는다.
  useEffect(() => {
    const map = mapRef.current;
    if (lineRef.current) {
      lineRef.current.setMap(null);
      lineRef.current = null;
    }
    if (!map || !route || route.length < 2) return;
    const kakao: Kakao = (window as Kakao).kakao;
    lineRef.current = new kakao.maps.Polyline({
      map,
      path: route.map((place) => new kakao.maps.LatLng(place.lat, place.lng)),
      strokeWeight: 4,
      strokeColor: LINE_COLOR,
      strokeOpacity: 0.85,
      strokeStyle: "shortdash",
    });
  }, [route]);

  // 날아가 달라는 곳이 오면 그리로.
  useEffect(() => {
    if (flyTo) fit(flyTo.places);
     
  }, [flyTo]);

  // 시트가 오르내리면 보이는 땅이 달라진다. 지도는 그대로 두고 범위만 다시 잰다.
  useEffect(() => {
    reportView();
     
  }, [bottomInset]);

  if (!apiKey || failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-bg-subtle p-6 text-center text-[14px] text-text-muted">
        지도를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" aria-label="내 여행 지도" role="application" />;
}

/*
  핀 하나. React 가 아니라 손으로 만든다 — 카카오 지도의 겹쳐 얹기는
  DOM 조각을 받는다. 확대할 때마다 새로 만들므로 가볍게 둔다.
*/
function pinElement({
  members,
  lead,
  photo,
  photos,
  on,
}: {
  members: HubPlace[];
  lead: HubPlace;
  photo: string | undefined;
  photos: number;
  on: boolean;
}): HTMLButtonElement {
  const many = members.length > 1;
  const size = photo ? (many ? 52 : 44) : many ? 30 : 16;

  const pin = document.createElement("button");
  pin.type = "button";
  pin.setAttribute(
    "aria-label",
    many ? `${lead.placeName} 외 ${members.length - 1}곳, 사진 ${photos}장` : `${lead.placeName}, 사진 ${lead.photoCount}장`,
  );
  Object.assign(pin.style, {
    position: "relative",
    width: `${size}px`,
    height: `${size}px`,
    padding: "0",
    borderRadius: photo ? "12px" : "999px",
    border: `2.5px solid ${on ? LINE_COLOR : "#ffffff"}`,
    background: photo ? `#dde3ea center / cover no-repeat url("${photo}")` : LINE_COLOR,
    boxShadow: "0 2px 8px rgba(0,0,0,0.28)",
    cursor: "pointer",
    transform: on ? "scale(1.12)" : "none",
    transition: "transform 150ms ease",
  });

  if (many) {
    const badge = document.createElement("span");
    badge.textContent = String(photos);
    Object.assign(badge.style, {
      position: "absolute",
      top: "-8px",
      right: "-8px",
      minWidth: "20px",
      height: "20px",
      padding: "0 5px",
      borderRadius: "10px",
      background: "#1d1d1f",
      color: "#ffffff",
      fontSize: "11px",
      fontWeight: "600",
      lineHeight: "20px",
      textAlign: "center",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
    });
    pin.appendChild(badge);
  }
  return pin;
}
