import type { Region } from "@/lib/types";

/*
  다녀온 곳이 어느 권역인지.

  좌표로 가르지 않는다. 경계선을 그어 두면 강 건너 한 블록 차이로 권역이
  바뀌고, 그 경계를 유지보수할 사람도 없다. 장소를 찾을 때 이미 받아 둔
  법정동 문자열("강원특별자치도 강릉시 송정동")의 맨 앞 칸이 곧 시도라,
  그것만 보면 틀릴 일이 없다.

  행정구역 이름은 바뀐다 — 강원도는 강원특별자치도가, 전라북도는
  전북특별자치도가 됐다. 옛 이름도 함께 받아 둔다. 기록에는 그때 받은
  이름이 그대로 남아 있기 때문이다.
*/

const BY_SIDO: Record<string, Region> = {
  서울특별시: "수도권",
  인천광역시: "수도권",
  경기도: "수도권",

  강원특별자치도: "강원권",
  강원도: "강원권",

  대전광역시: "충청권",
  세종특별자치시: "충청권",
  충청북도: "충청권",
  충청남도: "충청권",

  광주광역시: "전라권",
  전북특별자치도: "전라권",
  전라북도: "전라권",
  전라남도: "전라권",

  부산광역시: "경상권",
  대구광역시: "경상권",
  울산광역시: "경상권",
  경상북도: "경상권",
  경상남도: "경상권",

  제주특별자치도: "제주권",
  제주도: "제주권",
};

/**
 * 법정동 문자열에서 권역을 읽는다. 알 수 없으면 null.
 *
 * 카카오가 줄임말("서울")로 줄 때도 있어 앞부분만 맞아도 인정한다.
 */
export function regionOfDong(dong: string | null | undefined): Region | null {
  const head = dong?.trim().split(/\s+/)[0];
  if (!head) return null;

  const exact = BY_SIDO[head];
  if (exact) return exact;

  for (const [sido, region] of Object.entries(BY_SIDO)) {
    if (sido.startsWith(head) && head.length >= 2) return region;
  }
  return null;
}

/**
 * 한 여행이 걸친 권역들. 여러 권역을 넘나든 여행은 여러 개가 나온다.
 *
 * 서울에서 출발해 강릉에서 잔 1박 2일은 수도권이기도 하고 강원권이기도
 * 하다. 하나만 고르게 하면 "강원권으로 걸러도 그 여행이 안 나오는" 일이
 * 생긴다. 걸러내기는 잃지 않는 쪽으로 기운다.
 */
export function regionsOfTrip(visits: { dong?: string | null }[]): Region[] {
  const found = new Set<Region>();
  for (const visit of visits) {
    const region = regionOfDong(visit.dong);
    if (region) found.add(region);
  }
  return [...found];
}
