import { getSpotAddress } from "./media";
import type { Spot } from "./types";

/*
  Ranked search over the curated spots.

  The previous version concatenated name + summary + highlights + foods and did
  one substring test, which produced results people read as broken: "갈비"
  returned 경복궁 (a food tag), "회" returned 경복궁 too (it is inside 경회루),
  and "산" matched 64% of everything through the word 산책. Nothing was sorted
  either, so even an exact name match could sit tenth.

  So: foods and specialties are out of the index entirely, region/theme/season
  are in (people search "제주" and "야경"), and every field carries a weight so
  the best match sorts first.
*/

// Spaces and punctuation vary between what people type and what the data holds
// ("남산 서울타워" vs "남산서울타워"), so both sides are flattened first.
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s()[\]·&,~\-_/'"]/g, "");
}

const SCORE = {
  nameExact: 100,
  // Korean place names carry their head word at the end — 남이'섬', 관악'산',
  // 대천'해수욕장' — so a name ending in the query is a better hit than one
  // that merely starts with it (섬진강 for "섬", 산청 for "산").
  nameSuffix: 85,
  namePrefix: 80,
  nameIncludes: 60,
  region: 50,
  // 시·군·구, 읍·면·동 단위 지명. 권역보다 좁으므로 같은 급으로 둔다:
  // "강릉"으로 강릉의 여행지가, "경주"로 경주의 여행지가 나와야 한다.
  address: 48,
  theme: 45,
  season: 40,
  highlight: 25,
  summary: 15,
} as const;

// Addresses are matched a token at a time, and only from the start of a token:
// plain substring matching puts "장안동" (대전 서구 장안동) in the results for
// "안동". A place name is the head of its token — 강릉시, 애월읍, 진관동 — so
// a prefix test keeps the real hits and drops the accidental ones.
function addressMatches(address: string, q: string): boolean {
  if (!address) return false;
  return address
    .split(/\s+/)
    .map(normalize)
    .some((token) => token.startsWith(q));
}

// A single character matches far too much prose to be useful — "회" is inside
// 경회루, "산" inside 산책 — so one-character queries only look at names and
// tags, where a hit is deliberate.
const PROSE_MIN_QUERY_LENGTH = 2;

/** 0 means no match. Higher is a better match. */
export function scoreSpot(spot: Spot, query: string): number {
  const q = normalize(query);
  if (!q) return 0;

  const name = normalize(spot.name);
  const scores: number[] = [];

  if (name === q) scores.push(SCORE.nameExact);
  else if (name.endsWith(q)) scores.push(SCORE.nameSuffix);
  else if (name.startsWith(q)) scores.push(SCORE.namePrefix);
  else if (name.includes(q)) scores.push(SCORE.nameIncludes);

  if (normalize(spot.region).includes(q)) scores.push(SCORE.region);
  if (spot.themes.some((theme) => normalize(theme).includes(q))) scores.push(SCORE.theme);
  if (spot.seasons.some((season) => normalize(season).includes(q))) scores.push(SCORE.season);

  if (query.trim().length >= PROSE_MIN_QUERY_LENGTH) {
    // 한 글자 검색에서는 '로'·'구'처럼 의미 없는 글자가 전부 걸리므로 제외.
    if (addressMatches(getSpotAddress(spot.id), q)) scores.push(SCORE.address);
    if (spot.highlights.some((h) => normalize(h).includes(q))) scores.push(SCORE.highlight);
    if (normalize(spot.summary).includes(q)) scores.push(SCORE.summary);
  }

  if (scores.length === 0) return 0;
  // Best field decides the tier; matching several fields breaks ties within it.
  return Math.max(...scores) + (scores.length - 1);
}

export function matchesQuery(spot: Spot, query: string): boolean {
  return scoreSpot(spot, query) > 0;
}

/** Sorts by score, keeping the original order for spots that tie. */
export function sortByRelevance(spots: Spot[], query: string): Spot[] {
  if (!query.trim()) return spots;
  return spots
    .map((spot, index) => ({ spot, index, score: scoreSpot(spot, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.spot);
}

/** Name suggestions for the search box's autocomplete. */
export function suggestCompletions(spots: Spot[], query: string, limit = 5): Spot[] {
  const q = normalize(query);
  if (!q) return [];
  return spots
    .map((spot, index) => ({ spot, index, score: scoreSpot(spot, query) }))
    .filter((entry) => entry.score >= SCORE.nameIncludes)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.spot);
}

/** Starting points for someone who opens the search box with nothing in mind. */
export const SEARCH_SUGGESTIONS = ["야경", "해변", "한옥마을", "섬", "국립공원", "카페거리"];
