import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { isInKorea } from "@/lib/weatherGrid";
import { pickPlaceName } from "@/lib/photo/placeName";
import type { NearbyPlace } from "@/lib/photo/types";

/*
  좌표를 사람이 알아보는 장소 이름으로 바꾼다.

  카카오 REST 키는 서버에만 둔다. 브라우저로 내보내면 남이 우리 몫의
  호출 한도를 쓴다.
*/
const SEARCH_RADIUS_M = 1000;
const MAX_POINTS = 25;
const UPSTREAM_TIMEOUT_MS = 8000;
// 100m 남짓. 이보다 가까운 좌표는 같은 곳으로 보고 한 번만 물어본다.
const CACHE_PRECISION = 3;

const SPOTS = spotsData as Spot[];
const SPOT_NAMES = SPOTS.map((spot) => spot.name);
// 이름은 사람에게 보여줄 것이고, id 는 기록에 저장해 상세 페이지로 잇는 데 쓴다.
const ID_BY_NAME = new Map(SPOTS.map((spot) => [spot.name, spot.id]));

interface PlaceAnswer {
  title: string;
  isCuratedSpot: boolean;
  /** 100선 중 하나면 그 id. 기록에서 여행지 페이지로 잇는다. */
  spotId: string | null;
  dong: string | null;
}

// 사진 한 묶음 안에는 같은 자리에서 찍은 것이 많다. 한 번 물어본 곳은 다시 묻지 않는다.
const memo = new Map<string, PlaceAnswer>();

async function kakao(key: string, path: string, params: Record<string, string>) {
  const response = await fetch(
    `https://dapi.kakao.com/v2/local/${path}?${new URLSearchParams(params)}`,
    {
      headers: { Authorization: `KakaoAK ${key}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    },
  );
  return response.ok ? response.json() : null;
}

async function describe(key: string, lat: number, lng: number): Promise<PlaceAnswer> {
  const cacheKey = `${lat.toFixed(CACHE_PRECISION)},${lng.toFixed(CACHE_PRECISION)}`;
  const cached = memo.get(cacheKey);
  if (cached) return cached;

  const common = { x: String(lng), y: String(lat) };
  const [region, sights, culture] = await Promise.all([
    kakao(key, "geo/coord2regioncode.json", common),
    kakao(key, "search/category.json", {
      ...common,
      category_group_code: "AT4",
      radius: String(SEARCH_RADIUS_M),
      sort: "distance",
      size: "10",
    }),
    kakao(key, "search/category.json", {
      ...common,
      category_group_code: "CT1",
      radius: String(SEARCH_RADIUS_M),
      sort: "distance",
      size: "10",
    }),
  ]);

  const administrative = region?.documents?.find(
    (doc: { region_type: string }) => doc.region_type === "H",
  );
  const dong = administrative
    ? `${administrative.region_1depth_name} ${administrative.region_2depth_name} ${administrative.region_3depth_name}`
    : null;

  const nearby: NearbyPlace[] = [
    ...(sights?.documents ?? []),
    ...(culture?.documents ?? []),
  ].map((doc: { place_name: string; distance: string }) => ({
    name: doc.place_name,
    distanceM: Number(doc.distance),
  }));

  const picked = pickPlaceName(nearby, SPOT_NAMES, dong ?? undefined);
  const answer: PlaceAnswer = {
    title: picked?.title ?? dong ?? "알 수 없는 곳",
    isCuratedSpot: picked?.isCuratedSpot ?? false,
    spotId: picked?.isCuratedSpot ? (ID_BY_NAME.get(picked.title) ?? null) : null,
    dong,
  };

  memo.set(cacheKey, answer);
  return answer;
}

export async function POST(request: Request) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return Response.json({ error: "장소 조회 키가 설정되지 않았습니다" }, { status: 503 });
  }

  let points: unknown;
  try {
    points = (await request.json())?.points;
  } catch {
    return Response.json({ error: "요청을 읽지 못했습니다" }, { status: 400 });
  }

  if (!Array.isArray(points) || points.length === 0 || points.length > MAX_POINTS) {
    return Response.json({ error: `좌표는 1~${MAX_POINTS}개까지 보낼 수 있습니다` }, { status: 400 });
  }

  // 아무 좌표나 받아 주면 이 주소가 우리 키를 쓰는 공개 프록시가 된다.
  const valid = points.every(
    (point) =>
      typeof point?.lat === "number" &&
      typeof point?.lng === "number" &&
      isInKorea(point.lat, point.lng),
  );
  if (!valid) return Response.json({ error: "국내 좌표가 아닙니다" }, { status: 400 });

  try {
    const places = await Promise.all(
      (points as { lat: number; lng: number }[]).map((point) =>
        describe(key, point.lat, point.lng),
      ),
    );
    return Response.json({ places });
  } catch {
    return Response.json({ error: "장소를 찾지 못했습니다" }, { status: 502 });
  }
}
