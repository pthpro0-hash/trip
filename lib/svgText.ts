/*
  SVG 글자는 넘쳐도 알아서 줄이지 않는다. 칸 밖으로 삐져나가거나 옆
  글자를 덮는다. 브라우저에게 재어 달라고 하면 저장본을 만드는 쪽과
  값이 다를 수 있어서, 글자 폭을 어림해 미리 자른다.

  한글은 한 글자가 대략 글자 크기만큼, 영문·숫자는 그 절반 남짓이다.
  어림이 조금 넉넉한 쪽으로 틀려야 넘치지 않는다.
*/

function glyphWidth(char: string, fontSize: number): number {
  if (char === " ") return fontSize * 0.3;
  // 한글·한자·가나 같은 넓은 글자
  if (/[ᄀ-ᇿ　-鿿가-힯豈-﫿＀-￯]/.test(char)) return fontSize;
  if (/[A-Z0-9]/.test(char)) return fontSize * 0.64;
  return fontSize * 0.56;
}

/** 어림한 글자 폭. */
export function textWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) width += glyphWidth(char, fontSize);
  return width;
}

/** 폭 안에 들어가게 자른다. 잘랐으면 끝에 "…"를 붙인다. */
export function fitText(text: string, maxWidth: number, fontSize: number): string {
  if (textWidth(text, fontSize) <= maxWidth) return text;
  const room = maxWidth - glyphWidth("…", fontSize);
  let width = 0;
  let kept = "";
  for (const char of text) {
    width += glyphWidth(char, fontSize);
    if (width > room) break;
    kept += char;
  }
  return kept ? `${kept.trimEnd()}…` : "";
}

/**
 * 낱말들을 폭에 맞춰 여러 줄로. 낱말은 쪼개지 않는다.
 *
 * 줄이 모자라면 마지막 줄 끝을 "외 N곳"처럼 남은 수로 맺는다 — 말없이
 * 자르면 거기까지가 전부인 줄 안다.
 */
export function wrapWords(
  words: string[],
  maxWidth: number,
  fontSize: number,
  options: { maxLines?: number; separator?: string; rest?: (count: number) => string } = {},
): string[] {
  const { maxLines = Infinity, separator = " · ", rest = (count: number) => `외 ${count}곳` } = options;
  const lines: string[] = [];
  let line = "";
  for (const [index, word] of words.entries()) {
    const next = line ? `${line}${separator}${word}` : word;
    if (!line || textWidth(next, fontSize) <= maxWidth) {
      line = next;
      continue;
    }
    if (lines.length === maxLines - 1) {
      // 마지막 줄 — 남은 수를 붙일 자리가 날 때까지 덜어 낸다.
      const left = words.slice(index);
      const kept = line.split(separator);
      let tail = `${separator}${rest(left.length)}`;
      while (kept.length > 1 && textWidth(kept.join(separator) + tail, fontSize) > maxWidth) {
        left.unshift(kept.pop()!);
        tail = `${separator}${rest(left.length)}`;
      }
      lines.push(kept.join(separator) + tail);
      return lines;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

