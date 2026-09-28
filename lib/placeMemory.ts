import { distanceKm } from "./geo";

/*
  고친 곳 이름 기억하기.

  지도 서비스가 지어 준 이름을 사람이 고치면, 그 자리와 이름을 적어 둔다.
  다음에 사진을 가져올 때 이 거리 안의 곳은 그 이름으로 먼저 부른다.

  얼마나 가까워야 "같은 곳"인가 — 해변이나 산은 사진이 수백 m 에 걸쳐
  찍힌다. 너무 좁으면 같은 해변을 두고 다시 고쳐야 하고, 너무 넓으면
  옆 동네까지 그 이름이 된다. 400m 로 둔다.
*/

export const NAME_REACH_KM = 0.4;

export interface PlaceMemory {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

/** 이 자리에서 가장 가까운, 거리 안의 기억. 없으면 null. */
export function rememberedName(memories: PlaceMemory[], lat: number, lng: number): PlaceMemory | null {
  let best: PlaceMemory | null = null;
  let bestKm = Infinity;
  for (const memory of memories) {
    const km = distanceKm(memory, { lat, lng });
    if (km <= NAME_REACH_KM && km < bestKm) {
      best = memory;
      bestKm = km;
    }
  }
  return best;
}

/** 이 자리를 새로 고치면 지울, 거리 안의 옛 기억들. */
export function memoriesNear(memories: PlaceMemory[], lat: number, lng: number): PlaceMemory[] {
  return memories.filter((memory) => distanceKm(memory, { lat, lng }) <= NAME_REACH_KM);
}
