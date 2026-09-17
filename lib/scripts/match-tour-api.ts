// Investigation script (not part of the app): pairs each curated spot with a
// TourAPI content id so photos and long descriptions can be attached later.
// Writes docs/tour-api-match.json for human review — nothing is applied to
// spots.json automatically, because a wrong pairing puts the wrong photo on a
// real place, which is worse than having no photo.
import { writeFileSync } from "node:fs";
import spotsData from "../data/spots.json" with { type: "json" };
import type { Spot } from "../types";

const KEY = process.env.TOUR_API_KEY;
if (!KEY) throw new Error("TOUR_API_KEY missing in .env.local");

const SPOTS = spotsData as Spot[];
const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = `serviceKey=${KEY}&_type=json&MobileOS=ETC&MobileApp=YeohaengSesang`;

interface TourItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1?: string;
  firstimage?: string;
  dist?: string;
  mapx?: string;
  mapy?: string;
}

interface MatchRow {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  matchTitle: string | null;
  contentId: string | null;
  contentTypeId: string | null;
  addr: string | null;
  distanceM: number | null;
  similarity: number;
  firstimage: string | null;
  source: "location" | "keyword" | null;
  confidence: "확실" | "확인필요" | "없음";
}

// 12 관광지, 14 문화시설, 15 축제·공연, 25 여행코스, 28 레포츠. Excludes 32 숙박,
// 38 쇼핑, 39 음식점 — without this the nearest-by-name candidate for 불국사 is
// a 밀면 restaurant and for 통영 디피랑 a motel.
const SIGHT_TYPES = new Set(["12", "14", "15", "25", "28"]);

async function callApi(op: string, params: string): Promise<TourItem[]> {
  const response = await fetch(`${BASE}/${op}?${COMMON}&${params}`);
  const json = await response.json();
  const items = json?.response?.body?.items;
  const item = items && typeof items === "object" ? items.item : undefined;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function normalize(text: string) {
  return text.replace(/[()[\]·&,~\-_/'"]/g, "").replace(/\s+/g, "").toLowerCase();
}

function bigrams(text: string) {
  const set = new Set<string>();
  for (let i = 0; i < text.length - 1; i += 1) set.add(text.slice(i, i + 2));
  if (set.size === 0 && text.length > 0) set.add(text);
  return set;
}

// Dice coefficient over character bigrams: forgiving about the suffixes and
// qualifiers our names carry ("국립공원", "& 해상케이블카") that TourAPI titles
// often drop, without the false positives of plain substring matching.
function similarity(a: string, b: string) {
  const left = bigrams(normalize(a));
  const right = bigrams(normalize(b));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

// Our names bundle several places ("제부도 & 해상케이블카", "공주 백제 유적
// (공산성·무령왕릉)"); score candidates against each fragment and keep the best.
function nameVariants(name: string) {
  const variants = new Set<string>([name]);
  const beforeBracket = name.split(/[([]/)[0].trim();
  variants.add(beforeBracket);
  for (const part of beforeBracket.split(/[&·,]/)) {
    const trimmed = part.trim();
    if (trimmed.length >= 2) variants.add(trimmed);
  }
  return [...variants];
}

function bestSimilarity(spot: Spot, title: string) {
  return Math.max(...nameVariants(spot.name).map((variant) => similarity(variant, title)));
}

function pickBest(spot: Spot, candidates: TourItem[]) {
  let best: { item: TourItem; score: number } | null = null;
  for (const item of candidates) {
    if (!SIGHT_TYPES.has(String(item.contenttypeid))) continue;
    const score = bestSimilarity(spot, item.title ?? "");
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function matchSpot(spot: Spot): Promise<MatchRow> {
  const base: MatchRow = {
    id: spot.id,
    name: spot.name,
    region: spot.region,
    lat: spot.lat,
    lng: spot.lng,
    matchTitle: null,
    contentId: null,
    contentTypeId: null,
    addr: null,
    distanceM: null,
    similarity: 0,
    firstimage: null,
    source: null,
    confidence: "없음",
  };

  // Coordinates are the one field we trust completely (they were hand-checked
  // against maps), so the nearby search leads and the keyword search only fills
  // in when nothing close looks like the right place.
  const nearby = await callApi(
    "locationBasedList2",
    `mapX=${spot.lng}&mapY=${spot.lat}&radius=5000&numOfRows=30&pageNo=1&arrange=E`,
  );
  const nearbyBest = pickBest(spot, nearby);

  let chosen: { item: TourItem; score: number; source: "location" | "keyword" } | null = nearbyBest
    ? { ...nearbyBest, source: "location" }
    : null;

  if (!chosen || chosen.score < 0.6) {
    const keyword = nameVariants(spot.name).sort((a, b) => b.length - a.length)[0];
    const byKeyword = await callApi(
      "searchKeyword2",
      `keyword=${encodeURIComponent(keyword)}&numOfRows=20&pageNo=1`,
    );
    const keywordBest = pickBest(spot, byKeyword);
    if (keywordBest && (!chosen || keywordBest.score > chosen.score)) {
      chosen = { ...keywordBest, source: "keyword" };
    }
  }

  if (!chosen) return base;

  const { item, score, source } = chosen;
  const lat = Number(item.mapy);
  const lng = Number(item.mapx);
  const distanceM =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? Math.round(haversineMeters(spot.lat, spot.lng, lat, lng))
      : null;

  const confidence: MatchRow["confidence"] =
    score >= 0.6 && distanceM !== null && distanceM <= 3000
      ? "확실"
      : score >= 0.3 || (distanceM !== null && distanceM <= 1500)
        ? "확인필요"
        : "없음";

  return {
    ...base,
    matchTitle: item.title ?? null,
    contentId: item.contentid ?? null,
    contentTypeId: item.contenttypeid ?? null,
    addr: item.addr1 ?? null,
    distanceM,
    similarity: Math.round(score * 100) / 100,
    // The API hands back http:// for many images; our site is https, which the
    // browser would block as mixed content.
    firstimage: item.firstimage ? item.firstimage.replace(/^http:\/\//, "https://") : null,
    source,
    confidence,
  };
}

async function main() {
  const rows: MatchRow[] = [];
  for (const [index, spot] of SPOTS.entries()) {
    const row = await matchSpot(spot);
    rows.push(row);
    console.log(
      `${index + 1}/${SPOTS.length} ${spot.name} → ${row.matchTitle ?? "없음"} (${row.confidence}, 유사도 ${row.similarity}, ${row.distanceM ?? "-"}m)`,
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  const summary = {
    total: rows.length,
    확실: rows.filter((r) => r.confidence === "확실").length,
    확인필요: rows.filter((r) => r.confidence === "확인필요").length,
    없음: rows.filter((r) => r.confidence === "없음").length,
    사진있음: rows.filter((r) => r.firstimage).length,
  };
  console.log(summary);

  writeFileSync("docs/tour-api-match.json", JSON.stringify({ summary, rows }, null, 2), "utf-8");
  console.log("완료: docs/tour-api-match.json");
}

main();
