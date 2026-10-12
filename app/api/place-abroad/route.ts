import { isInKorea } from "@/lib/weatherGrid";

/*
  해외 좌표를 "영국 런던"처럼 나라와 지역 이름으로 바꾼다.

  카카오 장소 조회는 한국 안만 안다. 한국 밖은 OpenStreetMap 의 Nominatim(역지오코딩)에 묻는다 — 우리 서버가 대신 묻고(브라우저의
  접속 정보는 가지 않는다), 좌표는 1km 남짓으로 뭉개 보내며(정확한 자리를 건네지 않는다), 한 번 물은 곳은 기억한다. Nominatim 은
  초당 한 번만 허락하고 앱을 알아볼 이름을 요구한다. 가볍게 쓰는 서비스를 위한 것이라, 이용이 늘면 다른 제공처로 바꾼다.
*/
const MAX_POINTS = 10;
const UPSTREAM_TIMEOUT_MS = 8000;
/** 소수 둘째 자리 — 1km 남짓. 이보다 가까운 좌표는 같은 곳으로 본다. */
const PRECISION = 2;
/** 연달아 묻는 사이의 간격(초당 한 번 규칙). */
const GAP_MS = 1100;

interface Answer {
  title: string;
  isCuratedSpot: false;
  spotId: null;
  dong: string | null;
}

const memo = new Map<string, Answer>();
let lastAskedAt = 0;

async function ask(lat: number, lng: number): Promise<Answer | null> {
  const wait = lastAskedAt + GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastAskedAt = Date.now();

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toFixed(PRECISION),
    lon: lng.toFixed(PRECISION),
    zoom: "10",
    addressdetails: "1",
    "accept-language": "ko",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    headers: { "User-Agent": "yeohaeng-sesang/1.0 (travel photo sketch; https://yeohaeng-sesang.vercel.app)" },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { address?: Record<string, string>; display_name?: string };
  const address = body.address;
  if (!address) return null;

  const country = address.country ?? "";
  // 사람이 기억하는 단위로: 도시 > 읍 > 마을 > 구역 > 군 > 주(도).
  // 런던처럼 큰 도시가 구(시티오브웨스트민스터 등)로 쪼개져 나오는 곳은 사람이 부르는 이름(런던)을 쓴다.
  const metro = /그레이터런던/.test(`${address.state_district ?? ""} ${body.display_name ?? ""}`) ? "런던" : "";
  const local = metro || (address.city ?? address.town ?? address.village ?? address.suburb ?? address.county ?? address.state ?? "");
  const title = [country, local].filter((part, index, all) => part && all.indexOf(part) === index).join(" ");
  if (!title) return null;
  return { title, isCuratedSpot: false, spotId: null, dong: title };
}

export async function POST(request: Request) {
  let points: unknown;
  try {
    points = (await request.json())?.points;
  } catch {
    return Response.json({ error: "요청을 읽지 못했습니다" }, { status: 400 });
  }
  if (!Array.isArray(points) || points.length === 0 || points.length > MAX_POINTS) {
    return Response.json({ error: `좌표는 1~${MAX_POINTS}개까지 보낼 수 있습니다` }, { status: 400 });
  }
  // 아무 좌표나 받아 주면 이 주소가 남의 조회를 대신해 주는 공개 프록시가 된다. 해외 좌표만 받는다.
  const valid = points.every(
    (point) =>
      typeof point?.lat === "number" &&
      typeof point?.lng === "number" &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lng) &&
      Math.abs(point.lat) <= 90 &&
      Math.abs(point.lng) <= 180 &&
      !isInKorea(point.lat, point.lng),
  );
  if (!valid) return Response.json({ error: "해외 좌표가 아닙니다" }, { status: 400 });

  try {
    const places: Answer[] = [];
    for (const point of points as { lat: number; lng: number }[]) {
      const key = `${point.lat.toFixed(PRECISION)},${point.lng.toFixed(PRECISION)}`;
      let answer = memo.get(key) ?? null;
      if (!answer) {
        answer = await ask(point.lat, point.lng);
        if (answer) memo.set(key, answer);
      }
      // 못 알아낸 곳은 '해외'로라도 알린다 — 한국의 '알 수 없는 곳'보다 낫다.
      places.push(answer ?? { title: "해외", isCuratedSpot: false, spotId: null, dong: null });
    }
    return Response.json({ places });
  } catch {
    return Response.json({ error: "장소를 찾지 못했습니다" }, { status: 502 });
  }
}
