// Investigation helper: for spots the automatic matcher got wrong (bundled
// names like "쌍계사 & 화개장터", and spots whose match had no photo), look up
// candidates by a hand-picked keyword so a person can choose the right one.
import spotsData from "../data/spots.json" with { type: "json" };
import type { Spot } from "../types";

const KEY = process.env.TOUR_API_KEY;
if (!KEY) throw new Error("TOUR_API_KEY missing in .env.local");

const SPOTS = spotsData as Spot[];
const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = `serviceKey=${KEY}&_type=json&MobileOS=ETC&MobileApp=YeohaengSesang`;
const SIGHT_TYPES = new Set(["12", "14", "15", "25", "28"]);

// spot id → the keyword that names the place we actually mean.
const KEYWORDS: Record<string, string> = {
  "남산서울타워": "N서울타워",
  "성수동-거리-서울숲": "서울숲",
  "인천-차이나타운": "차이나타운",
  "임진각-파주-DMZ": "임진각",
  "대관령": "대관령",
  "뮤지엄-산-간현관광지": "뮤지엄산",
  "도째비골-스카이밸리-해랑전망대": "도째비골",
  "원대리-자작나무숲": "자작나무숲",
  "무릉계곡-무릉별유천지": "무릉계곡",
  "법주사-속리산-테마파크": "법주사",
  "공주-백제-유적-공산성무령왕릉": "공산성",
  "부여-백제-유적-부소산성궁남지": "부소산성",
  "변산반도-국립공원": "변산반도국립공원",
  "반디랜드-태권도원": "태권도원",
  "순천만국가정원-순천만습지": "순천만국가정원",
  "죽녹원-관방제림": "죽녹원",
  "목포-근대역사공간-해상케이블카": "목포해상케이블카",
  "해운대-송정해수욕장": "해운대해수욕장",
  "해동용궁사-오시리아-관광단지": "해동용궁사",
  "부산엑스더스카이-그린레일웨이": "부산엑스더스카이",
  "대구-서문시장-동성로": "서문시장",
  "팔공산": "팔공산",
  "영남알프스-간월재": "간월재",
  "대릉원-동궁과-월지첨성대-황리단길": "대릉원",
  "불국사-석굴암": "불국사",
  "울릉도-독도": "울릉도",
  "주왕산-주산지": "주왕산",
  "스페이스워크-포항": "스페이스워크",
  "쌍계사-화개장터": "쌍계사",
  "사천바다케이블카-아라마루-아쿠아리움": "사천바다케이블카",
  "제주올레길": "올레길",
  "머체왓-숲길": "머체왓",
};

interface TourItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1?: string;
  firstimage?: string;
  mapx?: string;
  mapy?: string;
}

async function search(keyword: string): Promise<TourItem[]> {
  const response = await fetch(
    `${BASE}/searchKeyword2?${COMMON}&keyword=${encodeURIComponent(keyword)}&numOfRows=30&pageNo=1`,
  );
  const json = await response.json();
  const items = json?.response?.body?.items;
  const item = items && typeof items === "object" ? items.item : undefined;
  if (!item) return [];
  return (Array.isArray(item) ? item : [item]).filter((i: TourItem) =>
    SIGHT_TYPES.has(String(i.contenttypeid)),
  );
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

async function main() {
  for (const [id, keyword] of Object.entries(KEYWORDS)) {
    const spot = SPOTS.find((s) => s.id === id);
    if (!spot) {
      console.log(`\n### ${id} — spots.json에 없음`);
      continue;
    }

    const candidates = await search(keyword);
    const ranked = candidates
      .map((item) => ({
        item,
        distance: distanceMeters(spot.lat, spot.lng, Number(item.mapy), Number(item.mapx)),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    console.log(`\n### ${spot.name}  (검색어: ${keyword})`);
    if (ranked.length === 0) {
      console.log("  후보 없음");
    }
    for (const { item, distance } of ranked) {
      console.log(
        `  ${item.contentid} | ${item.title} | ${Number.isFinite(distance) ? `${distance}m` : "거리?"} | 사진 ${item.firstimage ? "O" : "X"} | ${item.addr1 ?? ""}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
}

main();
