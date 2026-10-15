import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { isInKorea } from "@/lib/weatherGrid";

/*
  장소 이름으로 좌표를 찾는다 — 위치 정보가 없는 사진에 사람이 장소를 정해 줄 때(components/trip/photoImport/UnlocatedCard).

  카카오 REST 키는 서버에만 둔다(/api/place 와 같다). 한국 안의 장소만 돌려준다 — 지도는 한국만 보여 주기로 한 방침과 같고,
  아무 검색어나 받아 주는 공개 프록시가 되지 않게 길이와 개수를 제한한다.
*/
const MAX_QUERY = 40;
const MAX_RESULTS = 8;
const UPSTREAM_TIMEOUT_MS = 8000;

const SPOTS = spotsData as Spot[];
const ID_BY_NAME = new Map(SPOTS.map((spot) => [spot.name, spot.id]));

interface Place {
  title: string;
  /** 사람이 알아볼 주소(도로명 우선). */
  address: string;
  lat: number;
  lng: number;
  /** 법정동 문자열 앞부분("서울 종로구 세종로") — 권역을 읽는 데 쓴다. */
  dong: string | null;
  /** 여행 100선에 있는 곳이면 그 id. */
  spotId: string | null;
}

interface KakaoDocument {
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
}

/** 지번 주소("서울 종로구 세종로 1-91")에서 번지를 뗀 행정구역 부분. */
function dongOf(address: string | undefined): string | null {
  const parts = (address ?? "").split(/\s+/).filter((part) => part && !/^\d/.test(part));
  return parts.length > 0 ? parts.slice(0, 4).join(" ") : null;
}

function toPlace(doc: KakaoDocument): Place | null {
  const lat = Number(doc.y);
  const lng = Number(doc.x);
  const title = doc.place_name?.trim();
  if (!title || !Number.isFinite(lat) || !Number.isFinite(lng) || !isInKorea(lat, lng)) return null;
  return {
    title,
    address: doc.road_address_name || doc.address_name || "",
    lat,
    lng,
    dong: dongOf(doc.address_name),
    spotId: ID_BY_NAME.get(title) ?? null,
  };
}

export async function GET(request: Request) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    return Response.json({ error: "장소 조회 키가 설정되지 않았습니다" }, { status: 503 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length === 0 || query.length > MAX_QUERY) {
    return Response.json({ error: `검색어는 1~${MAX_QUERY}자로 보내 주세요` }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ query, size: String(MAX_RESULTS) })}`,
      {
        headers: { Authorization: `KakaoAK ${key}` },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) return Response.json({ error: "장소를 찾지 못했습니다" }, { status: 502 });

    const body: { documents?: KakaoDocument[] } = await response.json();
    const places = (body.documents ?? []).flatMap((doc) => {
      const place = toPlace(doc);
      return place ? [place] : [];
    });
    return Response.json({ places });
  } catch {
    return Response.json({ error: "장소를 찾지 못했습니다" }, { status: 502 });
  }
}
