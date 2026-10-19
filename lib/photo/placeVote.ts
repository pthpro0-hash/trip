import type { PlaceKind } from "./placeName";

/*
  한 방문의 이름을 사진 한 장이 아니라 여러 장으로 정한다.

  방문은 사진이 많은 곳이다(1km 안). 예전에는 첫 사진 한 장의 좌표로만 이름을 물어서, 그 한 장이 하필 길가나 주소 쪽에서 찍힌 것이면
  그 방문 전체가 주소 이름이 됐다. 앞 · 가운데 · 끝 사진 석 장(samplePoints)의 답을 모아 가장 나은 이름을 고른다(voteAnswer).
*/

/** 장소 조회(/api/place)의 한 곳 답. kind · candidates 는 새 응답에만 있다(해외 조회 · 옛 응답에는 없다). */
export interface PlaceAnswer {
  title: string;
  isCuratedSpot: boolean;
  spotId: string | null;
  dong: string | null;
  kind?: PlaceKind;
  /** 이름을 고칠 때 눌러서 고를 주변 후보. */
  candidates?: string[];
}

const RANK: Record<PlaceKind, number> = { spot: 4, here: 3, near: 2, area: 1 };

/** 이름이 얼마나 쓸 만한가. 종류를 모르는 답은 곳 이름이 붙은 것으로 본다(100선이면 spot). */
function rankOf(answer: PlaceAnswer): number {
  if (answer.kind) return RANK[answer.kind];
  return answer.isCuratedSpot ? RANK.spot : RANK.here;
}

const keyOf = (point: { lat: number; lng: number }) => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;

/** 한 방문에서 이름을 물어볼 사진의 자리 — 앞 · 가운데 · 끝. 같은 자리(100m)는 한 번만. */
export function samplePoints<T extends { lat: number; lng: number }>(shots: T[], max = 3): T[] {
  if (shots.length === 0) return [];
  const picks = [0, Math.floor((shots.length - 1) / 2), shots.length - 1];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const index of picks) {
    const shot = shots[index];
    const key = keyOf(shot);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shot);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 여러 장의 답에서 방문의 이름 하나를 고른다.
 *   1. 더 쓸 만한 종류가 이긴다 — 100선 > 바로 여기의 이름 > 근처 > 주소. 한 장이 주소여도 다른 장이 이름을 찾았으면 그 이름이다.
 *   2. 같은 종류끼리는 더 많은 장이 가리킨 이름. 같으면 먼저 찍은 사진의 것.
 * 후보(candidates)는 모든 장의 후보와 다른 이름들을 많이 나온 차례로 모은다(고른 이름은 뺀다).
 */
export function voteAnswer(answers: PlaceAnswer[]): PlaceAnswer {
  if (answers.length === 0) throw new Error("no answers");
  if (answers.length === 1) return answers[0];

  const best = Math.max(...answers.map(rankOf));
  const top = answers.filter((answer) => rankOf(answer) === best);
  const votes = new Map<string, number>();
  for (const answer of top) votes.set(answer.title, (votes.get(answer.title) ?? 0) + 1);
  const winner = top.reduce((chosen, answer) => ((votes.get(answer.title) ?? 0) > (votes.get(chosen.title) ?? 0) ? answer : chosen), top[0]);

  const base = winner.title.replace(/ 근처$/, "");
  const counts = new Map<string, number>();
  const order: string[] = [];
  const count = (name: string) => {
    if (!name || name === base || name === winner.title) return;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  };
  for (const answer of answers) {
    for (const name of answer.candidates ?? []) count(name);
    // 이름난 곳으로 붙은 다른 답의 이름도 후보다(주소는 후보가 아니다).
    if (answer.title !== winner.title && rankOf(answer) > RANK.area) count(answer.title.replace(/ 근처$/, ""));
  }
  const candidates = [...order].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)).slice(0, 4);

  return { ...winner, candidates };
}
