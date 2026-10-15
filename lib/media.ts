import mediaData from "./data/spot-media.json";
import type { SpotMedia } from "./types";

/*
  한국관광공사 자료 전체(소개글·이용 정보·사진 여섯 장까지, 약 170KB). 상세 화면(서버)이 쓴다.
  클라이언트(첫 화면·검색)는 이것을 가져오지 않는다 — 카드는 lib/mediaCard, 소개글은 lib/overviews.
*/

const MEDIA = mediaData as Record<string, SpotMedia>;

export function getSpotMedia(spotId: string): SpotMedia | undefined {
  return MEDIA[spotId];
}

export const PHOTO_CREDIT = "사진·소개 제공: 한국관광공사";
