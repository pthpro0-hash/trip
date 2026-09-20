import { getSpotAddress, getSpotOverview } from "./media";
import { isRomanQuery, romanize } from "./romanize";
import { synonymsFor } from "./synonyms";
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
  // 초성만 입력한 경우 (ㄱㅂㄱ → 경복궁). 이름 일부 일치와 비슷한 급.
  chosung: 55,
  // 로마자로 옮긴 이름 (gyeongbokgung → 경복궁).
  roman: 55,
  region: 50,
  // 시·군·구, 읍·면·동 단위 지명. 권역보다 좁으므로 같은 급으로 둔다:
  // "강릉"으로 강릉의 여행지가, "경주"로 경주의 여행지가 나와야 한다.
  address: 48,
  theme: 45,
  season: 40,
  highlight: 25,
  summary: 15,
  // 공식 소개글은 길어서 아무 낱말이나 걸리기 쉽다. 가장 낮은 자리에 둬서
  // '벚꽃'처럼 다른 데 없는 말은 찾아주되 순위는 넘보지 못하게 한다.
  overview: 10,
} as const;

// 동의어로 걸린 결과는 직접 쓴 낱말보다 아래에 오게 한다.
const SYNONYM_PENALTY = 5;

// 긴 글도 낱말 단위로, 낱말 앞에서부터 맞춘다. 한국어는 조사가 뒤에 붙으므로
// ("벚꽃이", "단풍으로") 앞자리 일치면 충분히 잡히고, 반대로 낱말 한가운데
// 우연히 겹치는 것은 걸러진다 — 대전 '장안동'이 '안동' 검색에 딸려오던 문제.
function prosePrefixMatches(text: string, q: string): boolean {
  if (!text) return false;
  return text
    .split(/\s+/)
    .some((token) => normalize(token).startsWith(q));
}

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

const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const SYLLABLES_PER_LEAD = 588;

/** "경복궁" → "ㄱㅂㄱ". 한글이 아닌 글자는 그대로 둔다. */
function toChosung(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    out +=
      code >= HANGUL_START && code <= HANGUL_END
        ? CHOSUNG[Math.floor((code - HANGUL_START) / SYLLABLES_PER_LEAD)]
        : char;
  }
  return out;
}

// 초성만으로 이뤄진 검색어일 때만 초성 매칭을 켠다. 한 글자(ㄱ)는 거의 모든
// 이름에 걸리므로 두 글자부터.
function isChosungQuery(text: string): boolean {
  return text.length >= 2 && [...text].every((char) => CHOSUNG.includes(char));
}

/** 편집거리가 max를 넘으면 max + 1을 돌려준다 (전체를 계산하지 않기 위해). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length];
}

// A single character matches far too much prose to be useful — "회" is inside
// 경회루, "산" inside 산책 — so one-character queries only look at names and
// tags, where a hit is deliberate.
const PROSE_MIN_QUERY_LENGTH = 2;

// 태그(권역·테마·계절)도 주소처럼 앞에서부터 맞춘다. 부분 문자열로 하면
// '절' 한 글자가 '사계절'에 걸려 57곳이 쏟아진다. 반대로 '자연'으로
// '자연경관'을 찾는 건 되어야 하므로 완전 일치까지 좁히지는 않는다.
function tagMatches(tag: string, q: string): boolean {
  return normalize(tag).startsWith(q);
}

/** 검색어 한 낱말에 대한 점수. 0이면 그 낱말은 이 여행지와 무관하다. */
function scoreTerm(spot: Spot, term: string): number {
  const q = normalize(term);
  if (!q) return 0;

  const name = normalize(spot.name);
  const scores: number[] = [];

  if (name === q) scores.push(SCORE.nameExact);
  else if (name.endsWith(q)) scores.push(SCORE.nameSuffix);
  else if (name.startsWith(q)) scores.push(SCORE.namePrefix);
  else if (name.includes(q)) scores.push(SCORE.nameIncludes);
  else if (isChosungQuery(q) && toChosung(name).includes(q)) scores.push(SCORE.chosung);

  if (tagMatches(spot.region, q)) scores.push(SCORE.region);
  if (spot.themes.some((theme) => tagMatches(theme, q))) scores.push(SCORE.theme);
  if (spot.seasons.some((season) => tagMatches(season, q))) scores.push(SCORE.season);

  if (isRomanQuery(q)) {
    const roman = romanize(spot.name);
    if (roman.includes(q) || romanize(spot.region).includes(q)) scores.push(SCORE.roman);
  }

  if (term.length >= PROSE_MIN_QUERY_LENGTH) {
    // 한 글자 검색에서는 '로'·'구'처럼 의미 없는 글자가 전부 걸리므로 제외.
    if (addressMatches(getSpotAddress(spot.id), q)) scores.push(SCORE.address);
    if (spot.highlights.some((h) => normalize(h).includes(q))) scores.push(SCORE.highlight);
    if (normalize(spot.summary).includes(q)) scores.push(SCORE.summary);
    if (prosePrefixMatches(getSpotOverview(spot.id), q)) scores.push(SCORE.overview);
  }

  if (scores.length === 0) return 0;
  // Best field decides the tier; matching several fields breaks ties within it.
  return Math.max(...scores) + (scores.length - 1);
}

/**
 * 한 낱말의 최종 점수. 그 말 그대로 못 찾으면 뜻이 비슷한 말로 한 번 더
 * 찾아본다 ('바닷가' → 해변). 동의어로 찾은 건 점수를 깎아, 직접 쓴 낱말이
 * 맞은 곳보다 뒤에 오게 한다.
 */
function scoreTermWithSynonyms(spot: Spot, term: string): number {
  const direct = scoreTerm(spot, term);
  if (direct > 0) return direct;

  let best = 0;
  for (const synonym of synonymsFor(term)) {
    const score = scoreTerm(spot, synonym);
    if (score > best) best = score;
  }
  return best > 0 ? Math.max(1, best - SYNONYM_PENALTY) : 0;
}

/**
 * 0 means no match. Higher is a better match.
 *
 * 띄어쓴 낱말은 모두 맞아야 한다("제주 해변" = 제주에 있는 해변). 예전에는
 * 검색어 전체를 한 덩어리로 맞춰서, 사람들이 가장 자연스럽게 쓰는
 * '지역 + 테마' 조합이 통째로 0건이었다.
 */
export function scoreSpot(spot: Spot, query: string): number {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;

  let total = 0;
  for (const term of terms) {
    const score = scoreTermWithSynonyms(spot, term);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}

/** "해운대 & 송정해수욕장" → 전체 이름과 각 조각. */
function nameVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  const head = name.split(/[([]/)[0];
  for (const part of head.split(/[&·,]/)) {
    const trimmed = part.trim();
    if (trimmed.length >= 2) variants.add(trimmed);
  }
  return [...variants];
}

/**
 * 결과가 없을 때 쓰는 오타 보정. 이름과의 편집거리가 1(긴 검색어는 2)
 * 이내인 곳을 돌려준다. 결과가 0건일 때만 부르는 것을 전제로 한다.
 */
export function suggestCorrection(spots: Spot[], query: string): Spot | null {
  const q = normalize(query);
  if (q.length < 2) return null;
  const max = q.length >= 5 ? 2 : 1;

  let best: { spot: Spot; distance: number } | null = null;
  for (const spot of spots) {
    // 묶음 이름은 조각별로도 비교한다. "해운데"를 "해운대 & 송정해수욕장"
    // 전체와 재면 거리가 한참 멀어 보정이 안 된다.
    for (const variant of nameVariants(spot.name)) {
      const distance = editDistance(q, normalize(variant), max);
      if (distance <= max && (!best || distance < best.distance)) {
        best = { spot, distance };
      }
    }
  }
  return best ? best.spot : null;
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
