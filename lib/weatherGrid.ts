/*
  기상청 예보 API는 위·경도가 아니라 자체 격자 번호(nx, ny)를 받는다.
  격자는 람베르트 정각원뿔 도법으로 만들어지며, 아래 상수와 식은
  기상청이 배포하는 좌표 변환 예제(dfs_xy_conv)와 같은 것이다.
*/

const RE = 6371.00877; // 지구 반경 (km)
const GRID = 5.0; // 격자 간격 (km)
const SLAT1 = 30.0; // 표준 위도 1
const SLAT2 = 60.0; // 표준 위도 2
const OLON = 126.0; // 기준점 경도
const OLAT = 38.0; // 기준점 위도
const XO = 43; // 기준점 X 격자
const YO = 136; // 기준점 Y 격자

const DEGRAD = Math.PI / 180.0;
const QUARTER_PI = Math.PI * 0.25;

const re = RE / GRID;
const slat1 = SLAT1 * DEGRAD;
const slat2 = SLAT2 * DEGRAD;
const olon = OLON * DEGRAD;
const olat = OLAT * DEGRAD;

const sn =
  Math.log(Math.cos(slat1) / Math.cos(slat2)) /
  Math.log(Math.tan(QUARTER_PI + slat2 * 0.5) / Math.tan(QUARTER_PI + slat1 * 0.5));
const sf = (Math.tan(QUARTER_PI + slat1 * 0.5) ** sn * Math.cos(slat1)) / sn;
const ro = (re * sf) / Math.tan(QUARTER_PI + olat * 0.5) ** sn;

export interface Grid {
  nx: number;
  ny: number;
}

export function latLngToGrid(lat: number, lng: number): Grid {
  const ra = (re * sf) / Math.tan(QUARTER_PI + lat * DEGRAD * 0.5) ** sn;

  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

/**
 * 우리가 다루는 건 국내 여행지뿐이다. 범위를 벗어난 좌표는 격자로
 * 바꿔 봐야 기상청이 빈 응답을 주므로, 요청 단계에서 걸러낸다.
 */
export function isInKorea(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 33 &&
    lat <= 39 &&
    lng >= 124 &&
    lng <= 132
  );
}
