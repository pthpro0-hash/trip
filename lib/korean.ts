const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const FINAL_COUNT = 28;
const RIEUL = 8;

/** 마지막 글자의 받침 번호. 받침이 없으면 0, 한글이 아니면 null. */
function finalConsonant(word: string): number | null {
  if (word.length === 0) return null;
  const code = word.charCodeAt(word.length - 1);
  if (code < HANGUL_FIRST || code > HANGUL_LAST) return null;
  return (code - HANGUL_FIRST) % FINAL_COUNT;
}

/**
 * 받침에 맞는 조사를 붙인다.
 *
 * "가족와 함께", "네이버지도으로 길찾기" 같은 말이 화면에 그대로 찍히는 것을
 * 막는다. 한글이 아닌 이름(영문·숫자)에는 받침 없는 쪽을 쓴다.
 *
 * @param afterFinal   받침이 있을 때 붙일 조사 (과, 으로, 은, 이…)
 * @param afterVowel   받침이 없을 때 붙일 조사 (와, 로, 는, 가…)
 * @param rieulAsVowel ㄹ 받침을 받침 없는 것처럼 다룰지. "-로/-으로"가 그렇다.
 */
export function attachParticle(
  word: string,
  afterFinal: string,
  afterVowel: string,
  rieulAsVowel = false,
): string {
  const final = finalConsonant(word);
  if (final === null || final === 0) return `${word}${afterVowel}`;
  if (rieulAsVowel && final === RIEUL) return `${word}${afterVowel}`;
  return `${word}${afterFinal}`;
}

/**
 * "누구와 함께" 한 줄.
 *
 * 혼자 다녀온 여행에 "혼자와 함께"라고 적으면 곤란하다.
 */
export function companionLabel(companions: string): string {
  const trimmed = companions.trim();
  if (trimmed.length === 0) return "";
  if (trimmed === "혼자") return "혼자";
  return `${attachParticle(trimmed, "과", "와")} 함께`;
}
