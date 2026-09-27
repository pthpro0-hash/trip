/*
  점들을 부드러운 한 줄로 잇는다.

  꺾은선으로 이으면 자로 그은 도면이 되고, 곡선으로 이으면 손으로 그은
  그림이 된다. 선 그림 카드는 뒤쪽이어야 한다.

  캣멀-롬 곡선을 베지어로 옮긴다. 곡선이 반드시 모든 점을 지나므로,
  다녀온 곳을 비껴가는 일이 없다. tension 이 작을수록 덜 휜다 — 너무
  휘면 가지 않은 바다 위로 선이 불룩 나간다.
*/

export interface Point {
  x: number;
  y: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function smoothPath(points: Point[], tension = 0.35): string {
  if (points.length === 0) return "";
  const [first] = points;
  if (points.length === 1) return `M${round(first.x)} ${round(first.y)}`;

  let d = `M${round(first.x)} ${round(first.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const before = points[i - 1] ?? points[i];
    const from = points[i];
    const to = points[i + 1];
    const after = points[i + 2] ?? to;

    const c1 = {
      x: from.x + ((to.x - before.x) * tension) / 2,
      y: from.y + ((to.y - before.y) * tension) / 2,
    };
    const c2 = {
      x: to.x - ((after.x - from.x) * tension) / 2,
      y: to.y - ((after.y - from.y) * tension) / 2,
    };
    d += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`;
  }
  return d;
}
