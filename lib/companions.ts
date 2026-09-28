/*
  동행자 추천.

  동행자는 가져올 때 적는 칸이 있지만, 그때는 사진 고르기에 바빠 대개
  비워 둔다. 나중에 채우려 할 때 매번 이름을 새로 치게 하면 "민수"와
  "민수 "와 "민수랑"이 따로 쌓여 한 장으로 보기의 "누구와"가 흩어진다.
  그래서 전에 적은 이름을 자주 쓴 순서로 내민다 — 누르면 그대로 들어간다.

  적은 적이 거의 없으면 흔한 말(혼자·가족·친구)로 채워 둔다.
*/

const COMMON = ["혼자", "가족", "친구", "연인"];

/**
 * 추천할 이름들. 자주 쓴 것부터, 같으면 가나다순. 지금 값은 뺀다.
 *
 * @param used 다른 여행들에 적어 둔 동행자(비었으면 null).
 */
export function companionSuggestions(used: (string | null)[], current: string, max = 6): string[] {
  const counts = new Map<string, number>();
  for (const value of used) {
    const name = value?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const mine = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([name]) => name);
  const now = current.trim();
  return [...new Set([...mine, ...COMMON])].filter((name) => name !== now).slice(0, max);
}
