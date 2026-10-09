import type { Shot, Trip } from "./types";

/*
  여행을 저장소에 적을 수 있는 글자 모양으로 바꾸고 되살린다.

  로그인하러 떠나면 화면이 새로 열려 찾은 여행이 사라진다. 떠나기 전에 이 브라우저 저장소(lib/photo/stash)에 적어 두고,
  돌아와 되살린다. 여기는 그 변환만 한다 — 저장소를 만지지 않는 순수한 함수다.

  Shot 은 한 방문과 한 여행이 같은 것을 가리킨다(같은 객체). 되살릴 때도 사진을 id 로 한 번만 만들어 그 관계를 지킨다.
  여행의 열쇠가 첫 사진의 id 라(PhotoImport 의 tripKey) 사진의 차례도 그대로 둔다.
*/

/** 촬영 시각은 밀리초 숫자다. 벽시계 그대로 — 같은 기기에서 되살리므로 시간대가 어긋나지 않는다. */
export interface StashedShot {
  id: string;
  takenAt: number;
  lat: number;
  lng: number;
}

export interface StashedTrip {
  shots: StashedShot[];
  /** 방문마다 든 사진의 id(차례대로). */
  visits: string[][];
}

export function toStashed(trips: Trip[]): StashedTrip[] {
  return trips.map((trip) => ({
    shots: trip.shots.map((shot) => ({ id: shot.id, takenAt: shot.takenAt.getTime(), lat: shot.lat, lng: shot.lng })),
    visits: trip.visits.map((visit) => visit.shots.map((shot) => shot.id)),
  }));
}

export function fromStashed(stashed: StashedTrip[]): Trip[] {
  return stashed.map((trip) => {
    const byId = new Map<string, Shot>(
      trip.shots.map((shot) => [shot.id, { id: shot.id, takenAt: new Date(shot.takenAt), lat: shot.lat, lng: shot.lng }]),
    );
    const shots = trip.shots.map((shot) => byId.get(shot.id)!);
    const visits = trip.visits.map((ids) => ({ shots: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])) }));
    return { shots, visits };
  });
}

/**
 * 실제로 올라갈 사진들 — 방문에 든 사진을 차례로. 같은 이름(열쇠)은 한 번만: 사진을 이름으로 찾으므로 여러 여행에 같은 이름이
 * 있어도 보관은 한 벌이다.
 */
export function shotsOf(trips: Trip[]): Shot[] {
  const seen = new Set<string>();
  const shots: Shot[] = [];
  for (const trip of trips) {
    for (const visit of trip.visits) {
      for (const shot of visit.shots) {
        if (seen.has(shot.id)) continue;
        seen.add(shot.id);
        shots.push(shot);
      }
    }
  }
  return shots;
}
