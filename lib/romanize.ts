/*
  국어의 로마자 표기법을 음절 단위로 옮긴다.

  TourAPI의 영문 서비스(EngService)는 이 키로 접근할 수 없어서(별도 활용신청
  대상) 공식 영문명을 받아올 수 없다. 대신 한글 음절을 초성·중성·종성으로
  쪼개 그대로 옮긴다. 음절 사이의 자음 동화(예: 종로 → jongno)까지는 다루지
  않지만, 지명 검색에는 충분하다: 경복궁 → gyeongbokgung, 제주 → jeju,
  해운대 → haeundae, 불국사 → bulguksa.
*/

const LEAD = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s",
  "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
];

const VOWEL = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa",
  "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];

const TAIL = [
  "", "k", "k", "k", "n", "n", "n", "t", "l", "k",
  "m", "p", "t", "t", "p", "l", "m", "p", "p", "t",
  "t", "ng", "t", "t", "k", "t", "p", "t",
];

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

export function romanize(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < HANGUL_START || code > HANGUL_END) {
      out += char.toLowerCase();
      continue;
    }
    const offset = code - HANGUL_START;
    out += LEAD[Math.floor(offset / 588)];
    out += VOWEL[Math.floor((offset % 588) / 28)];
    out += TAIL[offset % 28];
  }
  return out;
}

/** 검색어가 로마자(영문)로만 이뤄져 있는지. 한 글자는 너무 많이 걸린다. */
export function isRomanQuery(text: string): boolean {
  return text.length >= 2 && /^[a-z]+$/i.test(text);
}
