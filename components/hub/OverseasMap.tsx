"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { OSM_ATTRIBUTION, OSM_TILE_URL } from "@/lib/osmTiles";
import { fitTargets, groupPins, inKorea, inseparable, type Bounds, type HubPlace } from "@/lib/hub";
import { fitBottomPadding } from "./fitPadding";
import { pinElement, type FlyTarget } from "./HubMap";

/*
  해외 곳을 보는 지도.

  카카오 지도는 한국 밖에 그림이 없다. 해외 여행의 사진 핀은 이 지도 위에 얹는다 — OpenStreetMap 바탕(Leaflet). 핀 모양·겹침 묶기·
  범위 알림은 한국 지도(HubMap)와 같게 해서, 아래 시트의 목록과 카드가 똑같이 따라온다.

  바탕 그림은 외부(OpenStreetMap 재단)에서 받는다. 보는 지역의 좌표 범위가 그 서버에 전달되고 사진·기록은 가지 않는다(방침에 적음).
  이용 조건은 가볍게 쓸 때만 허락한다 — 많이 쓰게 되면 lib/osmTiles 한 줄을 다른 제공처로 바꾼다.
*/

/** 이 정도 가까우면 한 무리로 접는다(HubMap 과 같다). */
const REACH = 52;
const EDGE = 36;
/** 한 곳만 있을 때 이보다 더 당기지 않는다. */
const SOLO_ZOOM = 12;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet 은 동적으로 불러와 형을 느슨하게 둔다
type Leaflet = any;

interface OverseasMapProps {
  /** 해외 곳들(한국 안의 곳은 부르는 쪽이 뺀다). */
  places: HubPlace[];
  photoUrls: Map<string, string>;
  pickedIds: Set<string>;
  flyTo: FlyTarget | null;
  bottomInset: number;
  viewInset?: number;
  onView: (bounds: Bounds) => void;
  onPick: (places: HubPlace[]) => void;
}

export function OverseasMap({ places, photoUrls, pickedIds, flyTo, bottomInset, viewInset, onView, onPick }: OverseasMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet>(null);
  const libRef = useRef<Leaflet>(null);
  const markersRef = useRef<Leaflet[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  const viewBottom = viewInset ?? bottomInset;
  const latest = useRef({ places, photoUrls, pickedIds, bottomInset, viewBottom, onView, onPick });
  useEffect(() => {
    latest.current = { places, photoUrls, pickedIds, bottomInset, viewBottom, onView, onPick };
  });

  const reportView = () => {
    const map = mapRef.current;
    const box = containerRef.current;
    if (!map || !box) return;
    const visibleHeight = Math.max(1, box.clientHeight - latest.current.viewBottom);
    const sw = map.containerPointToLatLng([0, visibleHeight]);
    const ne = map.containerPointToLatLng([box.clientWidth, 0]);
    latest.current.onView({ south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng });
  };

  const fit = (given: { lat: number; lng: number }[]) => {
    const map = mapRef.current;
    const L = libRef.current;
    if (!map || !L) return;
    // 해외 곳이 있으면 그것만(한국 안의 곳이 섞여 와도 이 지도에는 그림이 없다).
    const abroad = given.filter((place) => !inKorea(place));
    const targets = abroad.length > 0 ? abroad : fitTargets(given);
    if (targets.length === 0) return;
    if (inseparable(targets)) {
      map.setView([targets[0].lat, targets[0].lng], SOLO_ZOOM);
      return;
    }
    const box = containerRef.current;
    const bottom = box ? fitBottomPadding(box.clientHeight, latest.current.bottomInset, EDGE) : latest.current.bottomInset;
    map.fitBounds(L.latLngBounds(targets.map((place) => [place.lat, place.lng])), {
      paddingTopLeft: [EDGE, EDGE],
      paddingBottomRight: [EDGE, EDGE + bottom],
    });
  };

  const redraw = () => {
    const map = mapRef.current;
    const L = libRef.current;
    if (!map || !L) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    const { places: all, photoUrls: urls, pickedIds: picked } = latest.current;
    const byId = new Map(all.map((place) => [place.visitId, place]));
    const pins = all.map((place) => {
      const point = map.latLngToContainerPoint([place.lat, place.lng]);
      return { id: place.visitId, x: point.x, y: point.y, weight: Math.max(1, place.photoCount) };
    });
    const size = map.getSize();

    for (const group of groupPins(pins, REACH)) {
      if (group.x < -REACH || group.y < -REACH || group.x > size.x + REACH || group.y > size.y + REACH) continue;
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
      // 핀의 가운데가 곳 위에 오게 한다.
      const holder = document.createElement("div");
      Object.assign(holder.style, { position: "absolute", transform: "translate(-50%, -50%)" });
      holder.appendChild(pin);
      const marker = L.marker([lead.lat, lead.lng], {
        icon: L.divIcon({ html: holder, className: "", iconSize: [0, 0] }),
        zIndexOffset: on ? 10_000 : Math.min(9_999, group.weight),
        keyboard: false,
      }).addTo(map);
      markersRef.current.push(marker);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const box = containerRef.current;
    if (!box) return;

    import("leaflet")
      .then((module) => {
        if (cancelled || !containerRef.current) return;
        const L = module.default ?? module;
        libRef.current = L;
        const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, worldCopyJump: true });
        L.tileLayer(OSM_TILE_URL, { maxZoom: 18, attribution: OSM_ATTRIBUTION }).addTo(map);
        // 시트가 아래를 덮으므로 저작자 표시는 위 오른쪽에 둔다(가려지면 표시한 것이 아니다).
        L.control.attribution({ position: "topright", prefix: false }).addTo(map);
        mapRef.current = map;

        map.on("moveend", () => {
          redraw();
          reportView();
        });

        const start = latest.current.places;
        if (start.length > 0) fit(start);
        else map.setView([20, 0], 2);
        setReady(true);
        redraw();
        reportView();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // 지도는 한 번만 세운다. 바뀌는 값은 latest 로 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 곳·사진·고른 것이 바뀌면 핀을 다시 얹는다.
  useEffect(() => {
    if (ready) {
      redraw();
      reportView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, places, photoUrls, pickedIds, bottomInset, viewInset]);

  useEffect(() => {
    if (ready && flyTo) fit(flyTo.places);
  }, [flyTo, ready]);

  if (failed) {
    return (
      <div className="grid h-full w-full place-items-center bg-bg-subtle p-6 text-center text-[14px] text-text-muted">
        해외 지도를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" aria-label="해외 여행 지도" role="application" />;
}
