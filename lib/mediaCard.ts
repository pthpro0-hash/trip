import cardData from "./data/spot-card.json";

/*
  목록 카드에 필요한 것만 — 대표 사진 주소와 주소(검색의 지명 맞춤).

  한국관광공사 자료(lib/data/spot-media.json)는 소개글·이용 정보·사진 여섯 장까지 커서(약 170KB) 첫 화면 JS 에 통째로 실렸다.
  카드는 그중 두 가지만 쓰므로, 생성해 둔 작은 파일(spot-card.json)에서 읽는다. 소개글은 lib/overviews 가 검색할 때 따로 받는다.
  이 파일들은 spot-media.json 에서 만든다(lib/scripts/fetch-tour-media.ts 가 함께 쓰고, lib/mediaCard.test.ts 가 어긋남을 막는다).
  상세 화면(서버)은 계속 lib/media 의 전체 자료를 쓴다.
*/
interface CardEntry {
  /** 대표 사진 주소. 사진이 없는 곳은 없다. */
  t?: string;
  /** 시·군·구와 읍·면·동까지 담긴 주소. */
  a: string;
}

const CARDS = cardData as Record<string, CardEntry>;

/** 목록 카드에 쓰는 대표 사진 한 장. 사진이 없는 곳도 있어 undefined 를 돌려줄 수 있다. */
export function getSpotThumbnail(spotId: string): string | undefined {
  return CARDS[spotId]?.t;
}

/** 검색에서 지명을 찾기 위한 주소. 매칭이 없는 곳은 빈 문자열. */
export function getSpotAddress(spotId: string): string {
  return CARDS[spotId]?.a ?? "";
}
