/** 사진 한 장에서 뽑아낸, 자리 잡는 데 필요한 것만. */
export interface Shot {
  /** 파일명. 같은 사진을 두 번 세지 않기 위한 열쇠. */
  id: string;
  /**
   * 촬영 시각. EXIF에는 타임존이 없어 "벽시계 시각"으로만 온다.
   * UTC로 바꾸는 순간 오전 사진이 전날로 밀린다 — 하지 않는다.
   */
  takenAt: Date;
  lat: number;
  lng: number;
}

/** 한 여행 안에서 한 장소에 머문 동안. */
export interface Visit {
  shots: Shot[];
}

/** 하루 또는 며칠에 걸친 한 번의 나들이. */
export interface Trip {
  shots: Shot[];
  visits: Visit[];
}

/** 집·직장처럼 여러 날에 걸쳐 되풀이해 찍히는 곳. */
export interface LivingArea {
  lat: number;
  lng: number;
  shots: Shot[];
  /** 서로 다른 날의 수. 사진 수가 아니라 이 값이 생활권을 가른다. */
  dayCount: number;
}

/** 지도 서비스가 알려주는 주변 장소 하나. */
export interface NearbyPlace {
  name: string;
  distanceM: number;
}
