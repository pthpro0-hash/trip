import spotsData from "@/lib/data/spots.json";
import { getSpotThumbnail } from "@/lib/media";
import type { Spot } from "@/lib/types";

/*
  100선 자료를 한데 묶어 둔 것. 내 여행 지도에서는 "100선 겹쳐 보기"를
  켤 때에야 불러온다 — 여행지 목록과 사진 정보가 합쳐 370KB 남짓이라,
  켜지도 않은 사람에게까지 지도를 열 때마다 받게 할 까닭이 없다.
*/
export const SPOTS = spotsData as Spot[];
export const thumbnailOf = getSpotThumbnail;
