/*
  글자를 맞춰 보는 기본 도구.

  여행지 검색과 내 기록 검색이 같은 것을 써야 한다. 한쪽에서 "남산 서울타워"가
  걸리는데 다른 쪽에서 안 걸리면, 쓰는 사람에게는 고장으로 보인다.
*/

/**
 * 사람이 치는 글자와 데이터에 담긴 글자는 띄어쓰기와 기호가 다르다
 * ("남산 서울타워" vs "남산서울타워"). 양쪽을 같은 모양으로 눕힌다.
 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s()[\]·&,~\-_/'"]/g, "");
}

const CHOSUNG = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const SYLLABLES_PER_LEAD = 588;

/** "경복궁" → "ㄱㅂㄱ". 한글이 아닌 글자는 그대로 둔다. */
export function toChosung(text: string): string {
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

/**
 * 초성만으로 이뤄진 검색어일 때만 초성 매칭을 켠다.
 * 한 글자(ㄱ)는 거의 모든 이름에 걸리므로 두 글자부터.
 */
export function isChosungQuery(text: string): boolean {
  return text.length >= 2 && [...text].every((char) => CHOSUNG.includes(char));
}
