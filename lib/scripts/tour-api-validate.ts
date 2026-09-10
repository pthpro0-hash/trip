// Spike script (throwaway): cross-checks the 98 curated spots against the
// Korea Tourism Organization TourAPI to (1) flag spots that no longer show
// up / look stale in TourAPI, and (2) surface candidate attractions TourAPI
// lists that aren't in our 98 yet. Writes a report to
// docs/tour-api-validation.md for human review — does not touch app data.
import { writeFileSync } from "node:fs";
import spotsData from "../data/spots.json" with { type: "json" };
import type { Spot } from "../types";

const KEY = process.env.TOUR_API_KEY;
if (!KEY) throw new Error("TOUR_API_KEY missing in .env.local");

const SPOTS = spotsData as Spot[];
const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = `serviceKey=${KEY}&_type=json&MobileOS=ETC&MobileApp=YeohaengSesang`;

// TourAPI areaCode -> our Region grouping.
const AREA_TO_REGION: Record<string, string> = {
  "1": "수도권", "2": "수도권", "31": "수도권",
  "32": "강원권",
  "3": "충청권", "8": "충청권", "33": "충청권", "34": "충청권",
  "5": "전라권", "37": "전라권", "38": "전라권",
  "4": "경상권", "6": "경상권", "7": "경상권", "35": "경상권", "36": "경상권",
  "39": "제주권",
};

interface TourItem {
  contentid: string;
  title: string;
  addr1: string;
  firstimage?: string;
  modifiedtime: string;
  areacode: string;
}

async function callApi(op: string, params: string): Promise<TourItem[]> {
  const res = await fetch(`${BASE}/${op}?${COMMON}&${params}`);
  const json = await res.json();
  const items = json?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

function normalize(name: string) {
  return name.replace(/[()·&,\s]/g, "").toLowerCase();
}

async function checkExisting() {
  const results: { spot: Spot; found: boolean; item?: TourItem }[] = [];
  for (const spot of SPOTS) {
    // A few of our names carry parenthetical qualifiers TourAPI won't match
    // verbatim (e.g. "한강공원 (여의도·뚝섬·반포 등)"); search on the part
    // before the first "(" or "&" to give the keyword match a fair shot.
    const keyword = spot.name.split(/[(&]/)[0].trim();
    const items = await callApi(
      "searchKeyword2",
      `keyword=${encodeURIComponent(keyword)}&numOfRows=5&pageNo=1`,
    );
    const match =
      items.find((i) => normalize(i.title) === normalize(spot.name)) ??
      items.find((i) => normalize(i.title).includes(normalize(keyword))) ??
      items[0];
    results.push({ spot, found: !!match, item: match });
    await new Promise((r) => setTimeout(r, 50));
  }
  return results;
}

async function findCandidates() {
  const byRegion = new Map<string, TourItem[]>();
  for (const areaCode of Object.keys(AREA_TO_REGION)) {
    const items = await callApi(
      "areaBasedList2",
      `areaCode=${areaCode}&contentTypeId=12&arrange=C&numOfRows=100&pageNo=1`,
    );
    const region = AREA_TO_REGION[areaCode];
    byRegion.set(region, [...(byRegion.get(region) ?? []), ...items]);
    await new Promise((r) => setTimeout(r, 50));
  }

  const ourNames = new Set(SPOTS.map((s) => normalize(s.name.split(/[(&]/)[0])));
  const candidatesByRegion = new Map<string, TourItem[]>();
  for (const [region, items] of byRegion) {
    const seen = new Set<string>();
    const candidates = items.filter((item) => {
      const key = normalize(item.title);
      if (ourNames.has(key) || seen.has(key)) return false;
      seen.add(key);
      return !!item.firstimage; // has a photo — weak signal of a maintained listing
    });
    candidatesByRegion.set(region, candidates);
  }
  return candidatesByRegion;
}

async function main() {
  console.log("1/2 기존 98곳 존재 여부 확인 중...");
  const existing = await checkExisting();
  const missing = existing.filter((r) => !r.found);
  const stale = existing.filter(
    (r) => r.found && r.item && r.item.modifiedtime < "20230101000000",
  );

  console.log("2/2 권역별 신규 후보 조회 중...");
  const candidates = await findCandidates();

  const lines: string[] = [];
  lines.push("# TourAPI 검증 리포트 (스파이크 결과)");
  lines.push("");
  lines.push(`생성 시각: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "이 문서는 검토용 조사 자료입니다. 앱 데이터(spots.json)는 이 리포트로 자동 반영되지 않습니다.",
  );
  lines.push("");
  lines.push("## 1. 기존 98곳 중 TourAPI에서 확인 안 되는 곳");
  lines.push("");
  if (missing.length === 0) {
    lines.push("없음 — 98곳 모두 TourAPI 키워드 검색에서 매칭되었습니다.");
  } else {
    lines.push("| 이름 | 권역 |");
    lines.push("|---|---|");
    for (const r of missing) lines.push(`| ${r.spot.name} | ${r.spot.region} |`);
  }
  lines.push("");
  lines.push("## 2. 매칭은 됐지만 정보가 오래된 곳 (2023년 이전 최종수정)");
  lines.push("");
  if (stale.length === 0) {
    lines.push("없음");
  } else {
    lines.push("| 이름 | 권역 | TourAPI 최종수정일 |");
    lines.push("|---|---|---|");
    for (const r of stale)
      lines.push(`| ${r.spot.name} | ${r.spot.region} | ${r.item!.modifiedtime} |`);
  }
  lines.push("");
  lines.push("## 3. 권역별 추가 후보 (현재 98곳에 없고, 사진이 있는 관광지)");
  lines.push("");
  for (const [region, items] of candidates) {
    lines.push(`### ${region} (${items.length}곳 후보)`);
    lines.push("");
    if (items.length === 0) {
      lines.push("없음");
    } else {
      lines.push("| 이름 | 주소 | 최종수정일 |");
      lines.push("|---|---|---|");
      for (const item of items.slice(0, 15)) {
        lines.push(`| ${item.title} | ${item.addr1} | ${item.modifiedtime} |`);
      }
      if (items.length > 15) lines.push(`| ...외 ${items.length - 15}곳 | | |`);
    }
    lines.push("");
  }

  writeFileSync("docs/tour-api-validation.md", lines.join("\n"), "utf-8");
  console.log("완료: docs/tour-api-validation.md");
}

main();
