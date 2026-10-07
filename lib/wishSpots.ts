import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";

/*
  가고 싶은 곳으로 고를 수 있는 곳 — 여행 100선. 사진 정보(spot-media, 300KB)는 빼고 목록만 쓴다. 이 파일을 부르는
  화면(부모님의 '가고 싶은 곳 보내기', 보내는 쪽의 책장 카드)에서만 받는다.
*/
export const wishSpots = spotsData as Spot[];

const byId = new Map(wishSpots.map((spot) => [spot.id, spot] as const));

export const spotById = (id: string): Spot | undefined => byId.get(id);
