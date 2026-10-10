import type { SketchTrip, SketchVisit } from "./sketch";

/*
  내 도감 — 시도 칸과 여행 100선 칸에 도장을 찍는다.

  지금까지 기록한 모든 여행(해를 가리지 않는다)에서 밟은 시도와 100선을 가린다. 100선은 방문에 붙은 spotId 로 알고, 100선이 어느
  시도인지는 좌표로 가린다. 서버·이용 기록 없이 이미 읽어 온 기록으로만 셈한다.
*/

/** 시도의 짧은 이름 열일곱(lib/sido 의 이름과 같다 — 시험이 맞춰 본다). 경계 데이터(60KB)를 부르지 않고도 칸을 그린다. */
export const SIDO_NAMES = ["서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];

export interface DexSpot {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface DexSido {
  name: string;
  /** 이 시도를 밟았는가(기록한 방문이 하나라도 있다). */
  visited: boolean;
  /** 이 시도의 100선과 그중 다녀온 곳. */
  spots: { id: string; name: string; done: boolean }[];
}

export interface Dex {
  sidos: DexSido[];
  sidoDone: number;
  spotTotal: number;
  spotDone: number;
}

type SidoOf = (visit: SketchVisit) => string | null;

export function buildDex(all: SketchTrip[], spots: DexSpot[], sidoNames: string[], sidoOf: SidoOf): Dex {
  const visits = all.flatMap((trip) => trip.visits);
  const visitedSido = new Set<string>();
  for (const visit of visits) {
    const name = sidoOf(visit);
    if (name) visitedSido.add(name);
  }
  const doneSpots = new Set(visits.flatMap((visit) => (visit.spotId ? [visit.spotId] : [])));

  const bySido = new Map<string, DexSido["spots"]>(sidoNames.map((name) => [name, []]));
  for (const spot of spots) {
    const name = sidoOf({ placeName: spot.name, spotId: spot.id, lat: spot.lat, lng: spot.lng, photoCount: 0 });
    if (!name || !bySido.has(name)) continue;
    bySido.get(name)!.push({ id: spot.id, name: spot.name, done: doneSpots.has(spot.id) });
  }

  const sidos = sidoNames.map((name) => ({ name, visited: visitedSido.has(name), spots: bySido.get(name)! }));
  const listed = sidos.flatMap((sido) => sido.spots);
  return {
    sidos,
    sidoDone: sidos.filter((sido) => sido.visited).length,
    spotTotal: listed.length,
    spotDone: listed.filter((spot) => spot.done).length,
  };
}
