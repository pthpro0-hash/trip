import { isInKorea, latLngToGrid } from "@/lib/weatherGrid";
import {
  latestBase,
  secondsUntilNextPublish,
  summarizeForecast,
  type DailyForecast,
  type ForecastItem,
} from "@/lib/weather";

const ENDPOINT = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst";
// 3일치 × 12개 항목 × 시간대. 넉넉히 받아 한 번에 끝낸다.
const NUM_OF_ROWS = 1000;
const UPSTREAM_TIMEOUT_MS = 8000;

/*
  같은 격자·같은 발표분은 몇 번을 물어도 답이 같다. 인스턴스가 살아 있는
  동안은 여기서 끊고, 그 앞단은 Cache-Control로 CDN이 받아 준다.
  개발계정 한도가 하루 1,000건이라 이 두 겹이 필요하다.
*/
const memo = new Map<string, DailyForecast[]>();

function jsonResponse(body: unknown, status: number, cacheSeconds?: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cacheSeconds
        ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`
        : "no-store",
    },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  // 아무 좌표나 받아 주면 이 엔드포인트가 우리 키를 쓰는 공개 프록시가 된다.
  if (!isInKorea(lat, lng)) {
    return jsonResponse({ error: "국내 좌표가 아닙니다" }, 400);
  }

  const serviceKey = process.env.TOUR_API_KEY;
  if (!serviceKey) {
    return jsonResponse({ error: "날씨 키가 설정되지 않았습니다" }, 503);
  }

  const now = new Date();
  const { nx, ny } = latLngToGrid(lat, lng);
  const { baseDate, baseTime } = latestBase(now);
  const cacheSeconds = Math.max(300, secondsUntilNextPublish(now));
  const key = `${nx},${ny},${baseDate}${baseTime}`;

  const cached = memo.get(key);
  if (cached) return jsonResponse({ days: cached }, 200, cacheSeconds);

  const query = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: String(NUM_OF_ROWS),
    dataType: "JSON",
    base_date: baseDate,
    base_time: baseTime,
    nx: String(nx),
    ny: String(ny),
  });

  try {
    const upstream = await fetch(`${ENDPOINT}?${query}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!upstream.ok) return jsonResponse({ error: "날씨를 가져오지 못했습니다" }, 502);

    // 한도 초과나 키 오류는 JSON이 아니라 XML로 돌아온다.
    const payload = await upstream.json().catch(() => null);
    const body = payload?.response?.body;
    if (payload?.response?.header?.resultCode !== "00" || !body) {
      return jsonResponse({ error: "날씨를 가져오지 못했습니다" }, 502);
    }

    const items: ForecastItem[] = body.items?.item ?? [];
    const days = summarizeForecast(items, now);
    if (days.length === 0) return jsonResponse({ error: "예보가 없습니다" }, 502);

    memo.set(key, days);
    return jsonResponse({ days }, 200, cacheSeconds);
  } catch {
    // 실패는 캐시하지 않는다 — 다음 요청은 다시 시도해야 한다.
    return jsonResponse({ error: "날씨를 가져오지 못했습니다" }, 502);
  }
}
