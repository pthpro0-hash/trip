import type { PickedPlace } from "./unlocated";

/** 장소 이름으로 찾은 한 곳 — 고르기 전에 보여 줄 주소가 붙는다. */
export interface FoundPlace extends PickedPlace {
  address: string;
}

/**
 * 장소 이름으로 한국 안의 곳을 찾는다(/api/place-search). 못 찾으면 빈 목록, 서버가 막히면 던진다 —
 * 부르는 쪽이 "찾지 못했어요"와 "검색하지 못했어요"를 가려 말할 수 있게.
 */
export async function searchPlaces(query: string): Promise<FoundPlace[]> {
  const response = await fetch(`/api/place-search?${new URLSearchParams({ q: query.trim() })}`);
  if (!response.ok) throw new Error("place search failed");
  const body: { places?: FoundPlace[] } = await response.json();
  return body.places ?? [];
}
