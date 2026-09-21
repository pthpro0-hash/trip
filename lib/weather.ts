/*
  기상청 단기예보(getVilageFcst) 응답을 화면에 쓸 하루 단위로 접는다.

  응답은 "날짜 + 시각 + 항목코드 + 값"이 한 줄씩 흩어져 오는 형태라
  (예: 20260921 1500 TMP 27), 하루치를 모아야 비로소 사람이 읽을 수 있다.
*/

export interface DailyForecast {
  /** YYYYMMDD */
  date: string;
  /** 오늘 / 내일 / 모레 */
  label: string;
  minTemp?: number;
  maxTemp?: number;
  /** 하늘 상태와 강수 형태를 합친 한 마디. */
  sky: string;
  /** 하루 중 가장 높은 강수확률(%). */
  rainChance: number;
}

export interface ForecastItem {
  fcstDate: string;
  fcstTime: string;
  category: string;
  fcstValue: string;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 단기예보 발표 시각(KST). 발표 후 자료가 올라오기까지 시간이 걸려,
// 넉넉히 45분이 지난 발표분을 쓴다.
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];
const PUBLISH_DELAY_MINUTES = 45;

// 하늘 상태(SKY)보다 강수 형태(PTY)가 우선한다. 비가 오는데 "구름많음"이라고
// 적으면 쓸모가 없다.
const SKY_LABEL: Record<string, string> = { "1": "맑음", "3": "구름많음", "4": "흐림" };
const PTY_LABEL: Record<string, string> = {
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "4": "소나기",
};

// 하루를 대표하는 시각. 한밤중 날씨로 "오늘 흐림"이라고 적지 않도록
// 낮 시간대 값을 고른다.
const REPRESENTATIVE_HOUR = 14;

/** getUTC*로 읽으면 KST가 되도록 9시간 밀어 둔 Date. 서버는 UTC로 돈다. */
function toKst(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function ymd(kst: Date): string {
  return `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`;
}

export function kstToday(now: Date): string {
  return ymd(toKst(now));
}

/** 지금 받을 수 있는 가장 최신 발표분. */
export function latestBase(now: Date): { baseDate: string; baseTime: string } {
  const kst = toKst(new Date(now.getTime() - PUBLISH_DELAY_MINUTES * 60_000));
  const hour = kst.getUTCHours();

  let baseHour = -1;
  for (const candidate of BASE_HOURS) {
    if (candidate <= hour) baseHour = candidate;
  }
  if (baseHour === -1) {
    // 자정 직후에는 전날 23시 발표가 가장 최신이다.
    kst.setUTCDate(kst.getUTCDate() - 1);
    baseHour = 23;
  }

  return { baseDate: ymd(kst), baseTime: `${pad(baseHour)}00` };
}

/**
 * 다음 발표까지 남은 초. 한 번 받은 예보는 다음 발표 전까지 바뀌지 않으므로,
 * 이 값을 캐시 수명으로 쓰면 같은 예보를 두 번 받아오지 않는다.
 * 하루 호출 한도(개발계정 1,000건)를 지키는 장치이기도 하다.
 */
export function secondsUntilNextPublish(now: Date): number {
  const kst = toKst(now);
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();

  for (const hour of BASE_HOURS) {
    const publish = hour * 60 + PUBLISH_DELAY_MINUTES;
    if (publish > minutes) return (publish - minutes) * 60;
  }
  // 오늘 남은 발표가 없으면 내일 첫 발표까지.
  return (24 * 60 - minutes + BASE_HOURS[0] * 60 + PUBLISH_DELAY_MINUTES) * 60;
}

function labelFor(date: string, today: string): string | null {
  if (date === today) return "오늘";

  const asDate = (value: string) =>
    Date.UTC(
      Number(value.slice(0, 4)),
      Number(value.slice(4, 6)) - 1,
      Number(value.slice(6, 8)),
    );
  const days = Math.round((asDate(date) - asDate(today)) / 86_400_000);

  if (days === 1) return "내일";
  if (days === 2) return "모레";
  return null;
}

function toNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 대표 시각에 가장 가까운 값. 그 시각이 이미 지났으면 남은 첫 값을 쓴다. */
function pickRepresentative(byHour: Map<number, string>): string | undefined {
  if (byHour.size === 0) return undefined;
  let best: number | undefined;
  for (const hour of byHour.keys()) {
    if (best === undefined || Math.abs(hour - REPRESENTATIVE_HOUR) < Math.abs(best - REPRESENTATIVE_HOUR)) {
      best = hour;
    }
  }
  return best === undefined ? undefined : byHour.get(best);
}

export function summarizeForecast(items: ForecastItem[], now: Date): DailyForecast[] {
  const today = kstToday(now);

  interface Bucket {
    temps: number[];
    min?: number;
    max?: number;
    sky: Map<number, string>;
    pty: Map<number, string>;
    pop: number;
  }
  const days = new Map<string, Bucket>();

  const bucketFor = (date: string) => {
    let bucket = days.get(date);
    if (!bucket) {
      bucket = { temps: [], sky: new Map(), pty: new Map(), pop: 0 };
      days.set(date, bucket);
    }
    return bucket;
  };

  for (const item of items) {
    if (labelFor(item.fcstDate, today) === null) continue;
    const bucket = bucketFor(item.fcstDate);
    const hour = Number(item.fcstTime.slice(0, 2));
    const value = toNumber(item.fcstValue);

    switch (item.category) {
      case "TMP":
        if (value !== undefined) bucket.temps.push(value);
        break;
      // TMN/TMX는 하루에 한 번만 오고, 오늘분은 이미 지났으면 아예 오지 않는다.
      case "TMN":
        if (value !== undefined) bucket.min = value;
        break;
      case "TMX":
        if (value !== undefined) bucket.max = value;
        break;
      case "SKY":
        bucket.sky.set(hour, item.fcstValue);
        break;
      case "PTY":
        if (item.fcstValue !== "0") bucket.pty.set(hour, item.fcstValue);
        break;
      case "POP":
        if (value !== undefined) bucket.pop = Math.max(bucket.pop, value);
        break;
    }
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => {
      const pty = pickRepresentative(bucket.pty);
      const sky = pickRepresentative(bucket.sky);
      return {
        date,
        label: labelFor(date, today)!,
        // 최저·최고가 따로 오지 않는 날은 시간대별 기온에서 끌어낸다.
        minTemp: bucket.min ?? (bucket.temps.length > 0 ? Math.min(...bucket.temps) : undefined),
        maxTemp: bucket.max ?? (bucket.temps.length > 0 ? Math.max(...bucket.temps) : undefined),
        sky: (pty && PTY_LABEL[pty]) || (sky && SKY_LABEL[sky]) || "정보 없음",
        rainChance: bucket.pop,
      };
    });
}
