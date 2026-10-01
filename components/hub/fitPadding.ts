/** 곳들을 맞춰 넣을 땅이 최소한 이만큼은 보여야 한다(px). */
export const MIN_FIT_HEIGHT = 140;

/**
 * 곳들을 지도에 맞춰 넣을 때 아래에 비울 여백.
 *
 * 시트가 덮은 높이만큼 비우는 것이 맞지만, 시트를 끝까지 올리면 지도 거의 전부를 덮어
 * 여백이 지도 높이를 넘는다. 그러면 맞출 땅이 음수라 지도가 엉뚱한 곳으로 가고, 목록의
 * "이 화면"이 비었다. 맞출 땅(위아래 가장자리를 뺀 높이)이 최소 MIN_FIT_HEIGHT 는 남게
 * 줄인다 — 이때 곳들은 시트에 가려지더라도 시트를 내리면 보이는 땅 안에 있다.
 */
export function fitBottomPadding(containerHeight: number, covered: number, edge: number): number {
  const room = Math.max(0, containerHeight - edge * 2 - MIN_FIT_HEIGHT);
  return Math.max(0, Math.min(covered, room));
}
