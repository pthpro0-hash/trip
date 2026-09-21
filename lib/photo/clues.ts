/*
  기억을 되살리는 단서.

  "특이사항을 적어주세요"라는 빈 칸 앞에서는 아무것도 떠오르지 않는다.
  그런데 "토요일이었고, 해질녘에 스무 장을 찍으셨네요"를 먼저 보여주면
  그날로 돌아가진다. 기록을 받아내는 가장 좋은 방법은 묻기 전에
  데려가는 것이다.

  여기 있는 것은 모두 이미 가진 값으로 만든다. 그날 날씨는 기상청 과거
  관측이 있어야 해서 아직 넣지 못했다.
*/

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function weekdayLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}요일`;
}

/** 해질녘, 아침, 한밤중… 찍은 시간대를 사람이 쓰는 말로. */
export function timeOfDayLabel(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "새벽";
  if (hour < 9) return "이른 아침";
  if (hour < 12) return "오전";
  if (hour < 15) return "한낮";
  if (hour < 18) return "늦은 오후";
  if (hour < 21) return "해질녘";
  return "밤";
}

/** 머문 시간. 너무 짧으면 말하지 않는다 — 한 번 찍고 지나간 곳이다. */
export function stayLabel(from: Date, to: Date): string | null {
  const minutes = Math.round((to.getTime() - from.getTime()) / 60_000);
  if (minutes < 10) return null;
  if (minutes < 60) return `${minutes}분 머물렀어요`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}시간 머물렀어요` : `${hours}시간 ${rest}분 머물렀어요`;
}

export interface TripClues {
  weekday: string;
  /** 사진을 가장 많이 찍은 시간대. */
  busiestTime: string | null;
  photoCount: number;
  placeCount: number;
}

export function tripClues(
  startedAt: Date,
  photoTimes: Date[],
  placeCount: number,
): TripClues {
  const byBand = new Map<string, number>();
  for (const time of photoTimes) {
    const band = timeOfDayLabel(time);
    byBand.set(band, (byBand.get(band) ?? 0) + 1);
  }
  const busiest = [...byBand.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    weekday: weekdayLabel(startedAt),
    // 한 장뿐이면 "그 시간대에 몰아 찍었다"고 할 것이 없다.
    busiestTime: busiest && photoTimes.length > 1 ? busiest[0] : null,
    photoCount: photoTimes.length,
    placeCount,
  };
}
