/*
  지도 허브의 계산.

  지도에 무엇을 얹고, 겹치는 것을 어떻게 묶고, 지금 화면에 무엇이 들어와
  있는지. 모두 지도 없이 셈할 수 있는 것들이라 여기로 뺐다 — 카카오
  지도는 시험 안에서 띄울 수 없고, 띄울 수 없는 것은 믿을 수도 없다.
*/

/** 지도에 얹는 한 곳. 방문 하나가 한 곳이다. */
export interface HubPlace {
  visitId: string;
  tripId: string;
  /** 그 여행의 이름. 없으면 날짜로 부른다. */
  tripLabel: string;
  placeName: string;
  lat: number;
  lng: number;
  /** "2026-09-14 06:11:00" 꼴. 여행 안에서 들른 순서를 가린다. */
  startedAt: string;
  photoCount: number;
  /** 핀에 얹을 사진. 사진을 올리지 않은 방문이면 null. */
  coverPath: string | null;
}

/** hubPlaces 가 읽는 여행의 모양. 저장된 여행(SavedTrip)이 이 꼴을 갖췄다. */
export interface HubTripInput {
  id: string;
  title: string | null;
  startedOn: string;
  endedOn: string;
  visits: {
    id: string;
    placeName: string;
    lat: number;
    lng: number;
    startedAt: string;
    photoCount: number;
  }[];
}

/** 제목이 없는 여행을 부를 이름. */
export function tripLabel(trip: { title: string | null; startedOn: string; endedOn: string }) {
  if (trip.title?.trim()) return trip.title.trim();
  const from = trip.startedOn.replaceAll("-", ".");
  if (trip.endedOn === trip.startedOn) return from;
  return `${from} ~ ${trip.endedOn.slice(5).replaceAll("-", ".")}`;
}

/** 여행들을 지도에 얹을 곳으로 편다. */
export function hubPlaces(trips: HubTripInput[], covers: Map<string, string>): HubPlace[] {
  return trips.flatMap((trip) =>
    trip.visits
      // 좌표가 없는 방문은 지도에 얹을 수 없다.
      .filter((visit) => Number.isFinite(visit.lat) && Number.isFinite(visit.lng))
      .map((visit) => ({
        visitId: visit.id,
        tripId: trip.id,
        tripLabel: tripLabel(trip),
        placeName: visit.placeName,
        lat: visit.lat,
        lng: visit.lng,
        startedAt: visit.startedAt,
        photoCount: visit.photoCount,
        coverPath: covers.get(visit.id) ?? null,
      })),
  );
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** 이 화면 안에 들어오는 곳. */
export function placesIn(places: HubPlace[], bounds: Bounds): HubPlace[] {
  return places.filter(
    (place) =>
      place.lat >= bounds.south &&
      place.lat <= bounds.north &&
      place.lng >= bounds.west &&
      place.lng <= bounds.east,
  );
}

export interface TripInView {
  tripId: string;
  label: string;
  /** 여행의 첫날. 새것부터 늘어놓는 데 쓴다. */
  startedOn: string;
  /** 이 화면 안에 든 곳들. 들른 순서대로. */
  places: HubPlace[];
  /** 이 화면 안에서 찍은 사진 수. */
  photoCount: number;
}

/**
 * 화면에 든 곳들을 여행으로 묶는다. 새 여행부터.
 *
 * 시트에는 지도 화면 안에 있는 것만 나온다. 지도를 옮기면 목록이
 * 따라 바뀐다 — 지도와 목록이 둘이 아니라 하나가 되는 자리가 여기다.
 */
export function tripsIn(
  places: HubPlace[],
  startedOnOf: (tripId: string) => string,
): TripInView[] {
  const byTrip = new Map<string, HubPlace[]>();
  for (const place of places) {
    const list = byTrip.get(place.tripId) ?? [];
    list.push(place);
    byTrip.set(place.tripId, list);
  }

  return [...byTrip.entries()]
    .map(([tripId, list]) => {
      const ordered = [...list].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
      return {
        tripId,
        label: ordered[0].tripLabel,
        startedOn: startedOnOf(tripId),
        places: ordered,
        photoCount: ordered.reduce((sum, place) => sum + place.photoCount, 0),
      };
    })
    .sort((a, b) => b.startedOn.localeCompare(a.startedOn) || a.tripId.localeCompare(b.tripId));
}

/** 화면 위 한 점. 지도의 좌표를 화면의 픽셀로 옮긴 것. */
export interface ScreenPin {
  id: string;
  x: number;
  y: number;
  /** 무거운 것이 무리의 얼굴이 된다. 여기서는 사진 수다. */
  weight: number;
}

export interface PinGroup {
  /** 얼굴이 되는 곳. 사진이 가장 많은 곳. */
  lead: string;
  ids: string[];
  x: number;
  y: number;
  /** 무리 전체의 사진 수. */
  weight: number;
}

/**
 * 화면에서 겹치는 핀을 묶는다.
 *
 * 지도 좌표가 아니라 화면 픽셀로 잰다. 전국을 볼 때는 30km 떨어진 두
 * 곳이 겹치고, 동네를 볼 때는 30m 떨어진 두 곳도 떨어져 보인다 — 겹침은
 * 땅이 아니라 화면의 일이다. 그래서 확대할 때마다 다시 묶는다.
 *
 * 사진이 많은 곳부터 자리를 잡는다. 그곳이 무리의 얼굴이 되고, 무리는
 * 얼굴이 있는 자리에 선다 — 가운데로 옮기면 아무도 가지 않은 바다
 * 위에 사진이 떠 있게 된다.
 */
export function groupPins(pins: ScreenPin[], reach: number): PinGroup[] {
  const ordered = [...pins].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const groups: PinGroup[] = [];

  for (const pin of ordered) {
    const near = groups.find((group) => Math.hypot(group.x - pin.x, group.y - pin.y) < reach);
    if (near) {
      near.ids.push(pin.id);
      near.weight += pin.weight;
    } else {
      groups.push({ lead: pin.id, ids: [pin.id], x: pin.x, y: pin.y, weight: pin.weight });
    }
  }
  return groups;
}

/**
 * 더 당겨도 갈라지지 않는 무리인가.
 *
 * 같은 곳에 두 번 다녀오면 두 방문이 한 점에 겹친다. 이런 무리를 누를
 * 때마다 확대하면 끝까지 당겨도 풀리지 않는다. 좌표가 사실상 같으면
 * 확대하지 않고 곧장 펼쳐 보인다.
 */
export function inseparable(places: { lat: number; lng: number }[]): boolean {
  if (places.length < 2) return true;
  const lats = places.map((place) => place.lat);
  const lngs = places.map((place) => place.lng);
  // 위도 0.0005도가 50m 남짓이다. 그 안이면 가장 당겨도 한 점이다.
  return Math.max(...lats) - Math.min(...lats) < 0.0005 && Math.max(...lngs) - Math.min(...lngs) < 0.0005;
}
