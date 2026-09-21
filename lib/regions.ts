import type { Region } from "./types";

export const REGIONS: Region[] = ["수도권", "강원권", "충청권", "전라권", "경상권", "제주권"];

/**
 * 한 권역을 다 본 사람이 목록으로 돌아가지 않고 옆 권역으로 넘어갈 수 있게 한다.
 * 끝에서는 처음으로 돌아온다 — 막다른 길을 만들지 않는다.
 */
export function adjacentRegions(region: Region): { prev: Region; next: Region } {
  const index = REGIONS.indexOf(region);
  const length = REGIONS.length;
  return {
    prev: REGIONS[(index - 1 + length) % length],
    next: REGIONS[(index + 1) % length],
  };
}
