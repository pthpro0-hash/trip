/*
  여행에 붙일 기본 제목.

  날짜("2026년 9월 13일 ~ 9월 14일")는 기억을 부르지 못한다. 장소로 지어야
  목록에서 훑을 때 "아, 그때" 가 나온다.

  제목은 고칠 수 있어야 하지만, 고치지 않아도 쓸 만해야 한다. 13건을
  가져왔는데 13번 이름을 물으면 대부분 그냥 넘긴다.
*/

export interface TitleSource {
  label: string;
  /** 그곳에서 찍은 사진 수. 많이 찍은 곳이 그날의 중심이다. */
  photoCount: number;
}

/**
 * 가장 오래 머문 곳을 앞세우고 나머지는 수로 적는다.
 *
 * 들른 차례대로 첫 곳을 쓰면 잠깐 스친 데가 제목이 된다 — 가평에서
 * 25장 중 20장을 송산리에서 찍었는데 1장뿐인 "큰섬"이 제목이 되는 식이다.
 */
export function buildTripTitle(sources: TitleSource[]): string {
  const named = sources.filter((source) => source.label.trim().length > 0);
  if (named.length === 0) return "";

  // 같은 수면 먼저 들른 곳을 앞세운다 — 새로고침마다 제목이 바뀌지 않게.
  const main = named.reduce((best, source) =>
    source.photoCount > best.photoCount ? source : best,
  );

  const others = new Set(named.map((source) => source.label));
  others.delete(main.label);

  if (others.size === 0) return main.label;
  if (others.size === 1) return `${main.label}·${[...others][0]}`;
  return `${main.label} 외 ${others.size}곳`;
}
