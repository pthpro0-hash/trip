import fs from "node:fs";
import path from "node:path";
import type { Region, Season, Theme, Spot } from "../types";

const REGION_HEADER = /^## (.+?) \(\d+곳\)/;
const SPOT_HEADER = /^### (.+)$/;
const FIELD_COORD = /^- \*\*위도, 경도\*\*:\s*(.+)$/;
const FIELD_SUMMARY = /^- \*\*요약\*\*:\s*(.+)$/;
const FIELD_HIGHLIGHTS_START = /^- \*\*꼭 볼 것\*\*:\s*$/;
const FIELD_SEASON = /^- \*\*추천 계절\*\*:\s*(.+)$/;
const FIELD_SPECIALTY = /^- \*\*특산물\*\*:\s*(.+)$/;
const FIELD_FOODS = /^- \*\*대표 음식\*\*:\s*(.+)$/;
const BULLET = /^\s*-\s+(.+)$/;

const THEME_RULES: [RegExp, Theme][] = [
  [/궁|종묘|서원|향교|읍성|유적|왕릉|고분|사찰|법주사|통도사|쌍계사|불국사|석굴암|현충사|향교/, "역사유적"],
  [/해수욕장|해변|갯벌|해안|바닷가/, "해변"],
  [/(?<!유)산(?!책)|봉|계곡|폭포|국립공원|휴양림|숲|자작나무|습지|늪|계곡/, "자연경관"],
  [/워터파크|놀이공원|테마파크|(?<!그)랜드(?!마크)|에버랜드/, "테마파크"],
  [/야경|전망대|타워|스카이|일몰|일출/, "야경"],
  [/민속촌|한옥마을|장터|시장|전통마을/, "체험마을"],
  [/수목원|정원|식물원|화원/, "정원"],
  [/(?<!뚝)섬(?!사람|진강)/, "섬"],
];

export function slugify(name: string): string {
  return name
    .trim()
    .replace(/[()·]/g, "")
    .replace(/&/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseCoord(raw: string): { lat: number; lng: number } {
  const match = raw.match(/(\d+\.\d+),\s*(\d+\.\d+)/);
  if (!match) throw new Error(`좌표를 파싱할 수 없습니다: ${raw}`);
  return { lat: Number(match[1]), lng: Number(match[2]) };
}

function parseSeasons(raw: string): { seasons: Season[]; seasonNote?: string } {
  const keywords: Season[] = ["사계절", "봄", "여름", "가을", "겨울"];
  const seasons = keywords.filter((k) => raw.includes(k));
  const notes = [...raw.matchAll(/\(([^)]+)\)/g)].map((m) => m[1]);
  return {
    seasons: seasons.length > 0 ? seasons : ["사계절"],
    seasonNote: notes.length > 0 ? notes.join(", ") : undefined,
  };
}

function splitCommaList(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function deriveThemes(name: string, highlights: string[]): Theme[] {
  const text = [name, highlights.join(" ")].join(" ");
  const themes = THEME_RULES.filter(([pattern]) => pattern.test(text)).map(([, theme]) => theme);
  return Array.from(new Set(themes));
}

interface Draft {
  name: string;
  highlights: string[];
  lat?: number;
  lng?: number;
  summary?: string;
  seasons?: Season[];
  seasonNote?: string;
  specialty?: string[];
  foods?: string[];
}

export function parseMarkdown(source: string): Spot[] {
  const lines = source.split("\n");
  const spots: Spot[] = [];

  let region: Region | null = null;
  let current: Draft | null = null;
  let collectingHighlights = false;

  const flush = () => {
    if (!current || !region) return;
    if (current.lat === undefined || current.lng === undefined) {
      throw new Error(`좌표가 없는 항목: ${current.name}`);
    }
    spots.push({
      id: slugify(current.name),
      name: current.name,
      region,
      lat: current.lat,
      lng: current.lng,
      summary: current.summary ?? "",
      highlights: current.highlights,
      seasons: current.seasons ?? ["사계절"],
      seasonNote: current.seasonNote,
      specialty: current.specialty ?? [],
      foods: current.foods ?? [],
      themes: deriveThemes(current.name, current.highlights),
    });
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    const regionMatch = line.match(REGION_HEADER);
    if (regionMatch) {
      flush();
      region = regionMatch[1].trim() as Region;
      collectingHighlights = false;
      continue;
    }

    const spotMatch = line.match(SPOT_HEADER);
    if (spotMatch) {
      flush();
      current = { name: spotMatch[1].trim(), highlights: [] };
      collectingHighlights = false;
      continue;
    }

    if (!current) continue;

    const coordMatch = line.match(FIELD_COORD);
    if (coordMatch) {
      Object.assign(current, parseCoord(coordMatch[1]));
      collectingHighlights = false;
      continue;
    }

    const summaryMatch = line.match(FIELD_SUMMARY);
    if (summaryMatch) {
      current.summary = summaryMatch[1].trim();
      collectingHighlights = false;
      continue;
    }

    if (FIELD_HIGHLIGHTS_START.test(line)) {
      collectingHighlights = true;
      continue;
    }

    const seasonMatch = line.match(FIELD_SEASON);
    if (seasonMatch) {
      Object.assign(current, parseSeasons(seasonMatch[1]));
      collectingHighlights = false;
      continue;
    }

    const specialtyMatch = line.match(FIELD_SPECIALTY);
    if (specialtyMatch) {
      current.specialty = splitCommaList(specialtyMatch[1]);
      collectingHighlights = false;
      continue;
    }

    const foodsMatch = line.match(FIELD_FOODS);
    if (foodsMatch) {
      current.foods = splitCommaList(foodsMatch[1]);
      collectingHighlights = false;
      continue;
    }

    if (collectingHighlights) {
      const bulletMatch = line.match(BULLET);
      if (bulletMatch) {
        current.highlights.push(bulletMatch[1].trim());
        continue;
      }
      collectingHighlights = false;
    }
  }

  flush();
  return spots;
}

export function parseMarkdownFile(filePath: string): Spot[] {
  const source = fs.readFileSync(filePath, "utf-8");
  return parseMarkdown(source);
}

if (require.main === module) {
  const sourcePath = path.join(process.cwd(), "data/source/tour-100-2025-2026.md");
  const outPath = path.join(process.cwd(), "lib/data/spots.json");
  const spots = parseMarkdownFile(sourcePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(spots, null, 2), "utf-8");
  console.log(`Parsed ${spots.length} spots -> ${outPath}`);
}
