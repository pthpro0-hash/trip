// Checks every hand-assigned contentId in data/tour-api-overrides.json:
// that the id resolves, that the title still matches what was recorded when it
// was chosen, how far it sits from our coordinates, and how many photos it has.
import overridesData from "../../data/tour-api-overrides.json" with { type: "json" };
import spotsData from "../data/spots.json" with { type: "json" };
import type { Spot } from "../types";

const KEY = process.env.TOUR_API_KEY;
if (!KEY) throw new Error("TOUR_API_KEY missing in .env.local");

const SPOTS = spotsData as Spot[];
const OVERRIDES = (overridesData as { overrides: Record<string, { contentId: string; title: string }> })
  .overrides;
const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = `serviceKey=${KEY}&_type=json&MobileOS=ETC&MobileApp=YeohaengSesang`;

async function json(url: string) {
  const response = await fetch(url);
  return response.json();
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
  const problems: string[] = [];

  for (const [spotId, override] of Object.entries(OVERRIDES)) {
    const spot = SPOTS.find((s) => s.id === spotId);
    if (!spot) {
      problems.push(`${spotId}: spots.json에 없는 id`);
      continue;
    }

    const common = await json(
      `${BASE}/detailCommon2?${COMMON}&contentId=${override.contentId}`,
    );
    const item = common?.response?.body?.items?.item;
    const detail = Array.isArray(item) ? item[0] : item;

    if (!detail) {
      problems.push(`${spot.name}: contentId ${override.contentId} 조회 실패`);
      continue;
    }

    const images = await json(
      `${BASE}/detailImage2?${COMMON}&contentId=${override.contentId}&imageYN=Y&numOfRows=30&pageNo=1`,
    );
    const photoCount = Number(images?.response?.body?.totalCount ?? 0);
    const overview = String(detail.overview ?? "");
    const distance =
      detail.mapy && detail.mapx
        ? distanceMeters(spot.lat, spot.lng, Number(detail.mapy), Number(detail.mapx))
        : null;

    const titleMatches = detail.title === override.title;
    console.log(
      `${titleMatches ? "OK " : "!! "}${spot.name}\n    → ${detail.title} (${override.contentId})` +
        `  사진 ${photoCount}장 · 소개 ${overview.length}자 · ${distance ?? "?"}m`,
    );
    if (!titleMatches) problems.push(`${spot.name}: 기록된 제목과 다름 ("${detail.title}")`);
    if (photoCount === 0) problems.push(`${spot.name}: 사진 0장`);
    if (overview.length < 100) problems.push(`${spot.name}: 소개글이 ${overview.length}자로 짧음`);

    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  console.log(`\n확인 필요 ${problems.length}건`);
  problems.forEach((p) => console.log(" -", p));
}

main();
