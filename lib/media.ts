import mediaData from "./data/spot-media.json";
import type { SpotMedia } from "./types";

const MEDIA = mediaData as Record<string, SpotMedia>;

export function getSpotMedia(spotId: string): SpotMedia | undefined {
  return MEDIA[spotId];
}

/** 목록 카드에 쓰는 대표 사진 한 장. 사진이 없는 곳도 있어 undefined를 반환할 수 있다. */
export function getSpotThumbnail(spotId: string): string | undefined {
  return MEDIA[spotId]?.images[0]?.url;
}

export const PHOTO_CREDIT = "사진·소개 제공: 한국관광공사";
