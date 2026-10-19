import type { NearbyPlace } from "./types";

/*
  좌표에 이름을 붙이는 일.

  가장 가까운 곳을 고르면 틀린다. 남산 자락에서 찍은 사진은 113m의
  "서울특별시교육청융합과학교육원 남산분관 천체투영실"이 가장 가깝지만,
  찍은 사람이 기억하는 이름은 268m의 "남산둘레길"이다.

  그래서 거리만 보지 않고 세 가지를 같이 본다.
   - 가까울수록 좋다
   - 이름이 짧을수록 좋다 (기관 정식명칭과 긴 코스명이 자연히 밀린다)
   - 사람들이 장소를 부르는 말로 끝나면 좋다
*/

const DISTANCE_WEIGHT = 1 / 100; // 100m당 1점
const LENGTH_WEIGHT = 1.5; // 한 글자당 1.5점
const PLACE_WORD_BONUS = 6;

/*
  얼마나 가까워야 "여기"라고 할 수 있는가.

  실제 사진 200장으로 재 보니 경계가 뚜렷했다. 맞은 답은 모두 140m 안쪽
  (솔뫼성지 106m · 대천해수욕장 112m · 남산둘레길 117m · 화진포해변 140m)이고,
  틀린 답은 모두 265m 밖(민어도 265m · 사기장골 330m · 도소골 411m ·
  후주골 452m)이었다. 내가 선 자리가 아니라 근처에 있는 다른 것들이다.

  다만 해변이나 둘레길처럼 넓게 퍼진 곳은 등록된 점이 멀 수 있다
  (송정해변 978m). 그래서 장소를 부르는 말로 끝나는 이름에만 멀리까지 허용한다.
*/
const NEAR_M = 200;
const FAR_M = 1000;

// 사람들이 "거기"라고 가리킬 때 쓰는 말들. "해파랑길 49코스"처럼
// 코스 번호로 끝나는 이름은 여기에 걸리지 않는다.
const PLACE_WORDS = [
  "해변", "해수욕장", "공원", "둘레길", "시장", "마을", "폭포", "계곡",
  "호수", "저수지", "섬", "산", "숲", "강", "천", "사", "궁", "성", "대교", "전망대",
];

export function scorePlaceName(place: NearbyPlace): number {
  const bonus = PLACE_WORDS.some((word) => place.name.endsWith(word)) ? PLACE_WORD_BONUS : 0;
  return place.distanceM * DISTANCE_WEIGHT + place.name.length * LENGTH_WEIGHT - bonus;
}

/*
  "근처"로 이름을 붙일 때 보는 범위.

  200m 안에 아무것도 없는 자리(길가·식당·숙소·시골)는 대부분 법정동 주소로 떨어졌다. 사람이 기억하는 것은 주소가 아니라 그 근처의
  이름난 곳이라, 더 멀리(1.5km)까지 찾아 "경복궁 근처"처럼 붙인다. 멀리서 찾은 이름은 거기 있었다고 말하지 않도록 늘 "근처"를 붙인다.

  다만 멀수록 엉뚱한 지명이 끼어든다(서산에서는 골짜기 이름만, 태안에서는 265m 밖의 섬이 나왔고, 둘 다 사람이 틀렸다고 바로잡았다).
  그래서 근처로 말할 수 있는 것은 이름난 곳의 말로 끝나는 것(LANDMARK_WORDS)과 100선뿐이다.
*/
export const NEARBY_M = 1500;

/** 근처의 이름난 곳이라고 부를 수 있는 말들. 장소를 가리키는 말(PLACE_WORDS)에 박물관 · 수목원 같은 시설을 더한 것이다. */
const LANDMARK_WORDS = [
  ...PLACE_WORDS,
  "박물관", "미술관", "전시관", "기념관", "수목원", "식물원", "정원", "테마파크", "타워", "온천", "휴양림",
  "서원", "향교", "고택", "유적", "유적지", "성지", "탑", "등대", "포구", "항", "오름", "관광지", "관광단지",
];

/** 근처의 이름난 곳으로 내세울 만한 이름인가. */
export function isLandmark(name: string): boolean {
  return LANDMARK_WORDS.some((word) => name.endsWith(word));
}

/**
 * 어떻게 붙은 이름인가.
 *   spot  여기 있는 100선
 *   here  바로 여기(200m, 넓은 곳은 1km)의 이름난 곳
 *   near  1.5km 안의 이름난 곳 — 이름에 "근처"가 붙는다
 *   area  가까이에 이름난 곳이 없어 법정동 주소로 물러남
 */
export type PlaceKind = "spot" | "here" | "near" | "area";

export interface PlaceNameResult {
  title: string;
  /** 우리가 소개글과 사진을 갖고 있는 한국관광 100선인가. */
  isCuratedSpot: boolean;
  kind: PlaceKind;
}

/** 그 자리라고 부를 만큼 가까운 후보만 남긴다. */
export function withinReach(nearby: NearbyPlace[]): NearbyPlace[] {
  return nearby.filter((place) => {
    if (place.distanceM <= NEAR_M) return true;
    if (place.distanceM > FAR_M) return false;
    // 멀리 있어도 장소를 부르는 말로 끝나면 넓게 퍼진 곳일 수 있다.
    return PLACE_WORDS.some((word) => place.name.endsWith(word));
  });
}

/**
 * 주변 장소 목록에서 이름 하나를 고른다.
 *
 * 100선이 목록에 있으면 그것이 최우선이다. 거리만으로 고르지 않는 이유가
 * 여기에 있다 — 지도 서비스는 장소의 실제 범위를 알지만 우리는 점 하나뿐이라,
 * 0.9km 떨어진 남산서울타워를 "여기"라고 부르는 일이 생긴다.
 */
export function pickPlaceName(
  nearby: NearbyPlace[],
  curatedSpotNames: string[],
  fallback?: string,
): PlaceNameResult | null {
  const reachable = withinReach(nearby);

  const curated = curatedSpotNames.find((spot) =>
    reachable.some((place) => place.name.includes(spot) || spot.includes(place.name)),
  );
  if (curated) return { title: curated, isCuratedSpot: true, kind: "spot" };

  const best = [...reachable].sort((a, b) => scorePlaceName(a) - scorePlaceName(b))[0];
  if (best) return { title: best.name, isCuratedSpot: false, kind: "here" };

  /*
    여기에는 없다. 1.5km 안의 이름난 곳이 있으면 "근처"로 붙인다 — 100선이 있으면 그것이 먼저, 없으면 가까우면서 짧은 이름.
    이름난 곳이 아닌 것(골짜기 지명 등)은 근처로도 말하지 않는다.
  */
  const wider = nearby.filter((place) => place.distanceM <= NEARBY_M);
  const nearCurated = curatedSpotNames.find((spot) => wider.some((place) => place.name.includes(spot) || spot.includes(place.name)));
  if (nearCurated) return { title: `${nearCurated} 근처`, isCuratedSpot: false, kind: "near" };

  const nearBest = wider.filter((place) => isLandmark(place.name)).sort((a, b) => scorePlaceName(a) - scorePlaceName(b))[0];
  if (nearBest) return { title: `${nearBest.name} 근처`, isCuratedSpot: false, kind: "near" };

  /*
    가까이에 이름난 곳이 없으면 법정동을 쓴다. "서산시 운산면 용현리"는
    시골에서 사람이 실제로 쓰는 단위다. 덜 구체적일 뿐 틀린 말이 아니고,
    엉뚱한 골짜기 이름을 대는 것보다 낫다.
  */
  return fallback ? { title: fallback, isCuratedSpot: false, kind: "area" } : null;
}

/**
 * 이름을 고칠 때 눌러서 고를 후보들 — 주변의 이름난 곳을 쓸 만한 차례로. 100선이 먼저다.
 * 자동으로 붙은 이름이 틀려도 타이핑하지 않고 한 번에 고칠 수 있게 한다.
 */
export function placeCandidates(nearby: NearbyPlace[], curatedSpotNames: string[], max = 5): string[] {
  const pool = nearby.filter((place) => place.distanceM <= NEAR_M || (place.distanceM <= NEARBY_M && isLandmark(place.name)));
  const curated = curatedSpotNames.filter((spot) => pool.some((place) => place.name.includes(spot) || spot.includes(place.name)));
  const ranked = [...pool].sort((a, b) => scorePlaceName(a) - scorePlaceName(b)).map((place) => place.name);
  return [...new Set([...curated, ...ranked])].slice(0, max);
}
