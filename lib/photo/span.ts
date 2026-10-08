/** "2026-09-13" 같은 날 열쇠를 해 · 달 · 일로 가른다. */
function parts(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return { year, month, date };
}

/**
 * 여행이 걸친 날들을 사람이 읽는 기간으로. 날은 오래된 것부터 정렬되어 들어온다(tripDays).
 *
 * 같은 해·같은 달이면 겹치는 앞부분은 한 번만 적는다: "2026년 9월 13일 ~ 14일".
 * 사이에 사진이 없는 날이 끼어 있어도 처음과 끝만 쓴다.
 */
export function spanText(days: string[]): string {
  if (days.length === 0) return "";
  const first = parts(days[0]);
  const start = `${first.year}년 ${first.month}월 ${first.date}일`;
  if (days.length === 1) return start;

  const last = parts(days[days.length - 1]);
  if (days[0] === days[days.length - 1]) return start;
  if (first.year !== last.year) return `${start} ~ ${last.year}년 ${last.month}월 ${last.date}일`;
  if (first.month !== last.month) return `${start} ~ ${last.month}월 ${last.date}일`;
  return `${start} ~ ${last.date}일`;
}
