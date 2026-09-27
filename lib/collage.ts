/*
  사진 콜라주 카드의 칸 나누기.

  같은 크기 칸을 바둑판처럼 늘어놓으면 앨범 목록이지 작품이 아니다.
  맨 위에 그해를 대표하는 한 장을 크게 두고, 그 아래로 줄마다 칸 수와
  폭을 조금씩 달리한다. 두 칸짜리 줄은 한쪽을 넓게 — 다음 두 칸 줄은
  반대쪽을 넓게 — 해서 눈이 지그재그로 흐르게 한다.

  사진 수마다 줄 모양을 손으로 정해 둔다. 몇 장이 오든 알아서 나누는
  셈을 짜는 것보다, 아홉 가지를 눈으로 보고 고른 편이 늘 보기 좋다.
*/

export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 한 줄. weight 는 줄 높이의 몫, cols 는 칸마다 폭의 몫. */
interface Row {
  weight: number;
  cols: number[];
}

/** 콜라주에 얹는 가장 많은 사진 수. */
export const COLLAGE_MAX = 9;

const ROWS: Record<number, Row[]> = {
  1: [{ weight: 1, cols: [1] }],
  2: [
    { weight: 1, cols: [1] },
    { weight: 1, cols: [1] },
  ],
  3: [
    { weight: 1.35, cols: [1] },
    { weight: 1, cols: [1, 1] },
  ],
  4: [
    { weight: 1.3, cols: [1] },
    { weight: 0.8, cols: [1, 1, 1] },
  ],
  5: [
    { weight: 1.2, cols: [1] },
    { weight: 0.9, cols: [1.4, 1] },
    { weight: 0.9, cols: [1, 1.4] },
  ],
  6: [
    { weight: 1.2, cols: [1] },
    { weight: 0.9, cols: [1.4, 1] },
    { weight: 0.75, cols: [1, 1, 1] },
  ],
  7: [
    { weight: 1.1, cols: [1] },
    { weight: 0.8, cols: [1, 1, 1] },
    { weight: 0.8, cols: [1, 1, 1] },
  ],
  8: [
    { weight: 1, cols: [1.4, 1] },
    { weight: 0.8, cols: [1, 1, 1] },
    { weight: 0.8, cols: [1, 1, 1] },
  ],
  9: [
    { weight: 1.1, cols: [1] },
    { weight: 0.8, cols: [1, 1.4] },
    { weight: 0.7, cols: [1, 1, 1] },
    { weight: 0.7, cols: [1, 1, 1] },
  ],
};

/**
 * 콜라주에 얹을 곳을 고르고 차례를 세운다.
 *
 * 가장 큰 첫 칸에는 사진을 가장 많이 남긴 곳 — 오래 머문 곳이 그해를
 * 가장 잘 말해 준다. 나머지는 사진 많은 곳부터 고르되, 놓는 차례는
 * 간 날 순서로 한다. 위에서 아래로 읽으면 그해가 흘러간다.
 */
export function collagePicks<T extends { photoPath: string | null; photoCount: number; lastVisitedOn: string }>(
  dots: T[],
  max = COLLAGE_MAX,
): T[] {
  const [hero, ...rest] = dots
    .filter((dot) => dot.photoPath)
    .sort((a, b) => b.photoCount - a.photoCount)
    .slice(0, max);
  if (!hero) return [];
  return [hero, ...rest.sort((a, b) => a.lastVisitedOn.localeCompare(b.lastVisitedOn))];
}

/**
 * 틀 안을 사진 수만큼 칸으로 나눈다. 첫 칸이 가장 크다.
 *
 * 사진이 없으면 빈 배열, 너무 많으면 COLLAGE_MAX 장까지만 나눈다.
 */
export function collageTiles(count: number, box: Tile, gap: number): Tile[] {
  const rows = ROWS[Math.min(Math.floor(count), COLLAGE_MAX)];
  if (!rows) return [];

  const tiles: Tile[] = [];
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const heightLeft = box.height - gap * (rows.length - 1);
  let y = box.y;

  for (const row of rows) {
    const height = (heightLeft * row.weight) / totalWeight;
    const colWeight = row.cols.reduce((sum, col) => sum + col, 0);
    const widthLeft = box.width - gap * (row.cols.length - 1);
    let x = box.x;
    for (const col of row.cols) {
      const width = (widthLeft * col) / colWeight;
      tiles.push({ x, y, width, height });
      x += width + gap;
    }
    y += height + gap;
  }
  return tiles;
}

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
