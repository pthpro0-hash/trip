// Pulls photos and the long official description for each spot from TourAPI and
// writes lib/data/spot-media.json. Run manually (not part of the build): the
// dev quota is 1,000 calls a day and this costs two per spot, so the results
// are committed rather than fetched at request time.
//
//   npx tsx --env-file=.env.local lib/scripts/fetch-tour-media.ts
import { writeFileSync } from "node:fs";
import overridesData from "../../data/tour-api-overrides.json" with { type: "json" };
import matchData from "../../docs/tour-api-match.json" with { type: "json" };
import spotsData from "../data/spots.json" with { type: "json" };
import type { Spot } from "../types";

const KEY = process.env.TOUR_API_KEY;
if (!KEY) throw new Error("TOUR_API_KEY missing in .env.local");

const SPOTS = spotsData as Spot[];
const OVERRIDES = (
  overridesData as { overrides: Record<string, { contentId: string; title: string }> }
).overrides;
const MATCHES = (matchData as { rows: { id: string; contentId: string | null; confidence: string }[] })
  .rows;

const BASE = "https://apis.data.go.kr/B551011/KorService2";
const COMMON = `serviceKey=${KEY}&_type=json&MobileOS=ETC&MobileApp=YeohaengSesang`;
const MAX_IMAGES = 6;

// 제1유형 출처표시, 제3유형 출처표시+변경금지 — both fine for showing a photo
// unaltered with a credit line. Anything else (commercial-use or derivative
// restrictions) is left out rather than guessed at.
const USABLE_COPYRIGHT = new Set(["Type1", "Type3"]);

interface SpotPractical {
  useTime?: string;
  restDate?: string;
  fee?: string;
  parking?: string;
  phone?: string;
}

interface SpotMedia {
  contentId: string;
  sourceTitle: string;
  /** 시·군·구와 읍·면·동까지 담긴 도로명 주소. 검색에서 지명을 찾는 데 쓴다. */
  address: string;
  overview: string;
  homepage: string | null;
  /** 이용시간·휴무일·요금·주차·문의. 가기 전에 확인해야 하는 것들. */
  practical: SpotPractical;
  images: { url: string; copyright: string }[];
}

/*
  detailIntro2의 필드 이름은 콘텐츠 유형마다 다르다 — 관광지는 usetime,
  문화시설은 usetimeculture, 레포츠는 usetimeleports. 유형별로 나열하는
  대신 접두사로 고른다. 새 유형이 섞여도 그대로 동작한다.
*/
function pickPractical(intro: Record<string, unknown>): SpotPractical {
  const find = (matches: (key: string) => boolean) => {
    for (const [key, value] of Object.entries(intro)) {
      if (!matches(key.toLowerCase())) continue;
      const text = cleanText(String(value ?? ""));
      if (text) return text;
    }
    return undefined;
  };

  return {
    useTime: find((k) => k.startsWith("usetime") || k === "playtime"),
    restDate: find((k) => k.startsWith("restdate")),
    fee: find((k) => k.startsWith("usefee")),
    parking: find((k) => k.startsWith("parking") && !k.includes("fee")),
    phone: find((k) => k.startsWith("infocenter")),
  };
}

async function json(url: string) {
  const response = await fetch(url);
  return response.json();
}

function toList(items: unknown) {
  if (!items || typeof items !== "object") return [];
  const item = (items as { item?: unknown }).item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

function https(url: string) {
  return url.replace(/^http:\/\//, "https://");
}

// TourAPI text fields arrive as HTML fragments: <br> line breaks, the odd <b>,
// and entities. Flatten them so the app never renders raw markup.
function cleanText(raw: string) {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function resolveContentId(spot: Spot): string | null {
  const override = OVERRIDES[spot.id];
  if (override) return override.contentId;
  const match = MATCHES.find((row) => row.id === spot.id);
  // 없음 means the automatic matcher found nothing believable; attaching that
  // content would put another place's photos on this spot.
  if (!match || match.confidence === "없음") return null;
  return match.contentId;
}

async function fetchMedia(contentId: string): Promise<SpotMedia | null> {
  const common = await json(`${BASE}/detailCommon2?${COMMON}&contentId=${contentId}`);
  const detail = toList(common?.response?.body?.items)[0] as
    | {
        title?: string;
        overview?: string;
        homepage?: string;
        addr1?: string;
        addr2?: string;
        contenttypeid?: string;
      }
    | undefined;
  if (!detail) return null;

  const intro = await json(
    `${BASE}/detailIntro2?${COMMON}&contentId=${contentId}&contentTypeId=${detail.contenttypeid ?? "12"}`,
  );
  const introItem = (toList(intro?.response?.body?.items)[0] ?? {}) as Record<string, unknown>;

  const imageResponse = await json(
    `${BASE}/detailImage2?${COMMON}&contentId=${contentId}&imageYN=Y&numOfRows=30&pageNo=1`,
  );
  const images = (
    toList(imageResponse?.response?.body?.items) as {
      originimgurl?: string;
      smallimageurl?: string;
      cpyrhtDivCd?: string;
    }[]
  )
    .filter((image) => image.originimgurl && USABLE_COPYRIGHT.has(String(image.cpyrhtDivCd)))
    .slice(0, MAX_IMAGES)
    .map((image) => ({ url: https(image.originimgurl!), copyright: String(image.cpyrhtDivCd) }));

  // homepage comes wrapped in an <a href> tag more often than not.
  const homepageMatch = String(detail.homepage ?? "").match(/https?:\/\/[^"'\s<>]+/);

  return {
    contentId,
    sourceTitle: String(detail.title ?? ""),
    address: [detail.addr1, detail.addr2].filter(Boolean).join(" ").trim(),
    overview: cleanText(String(detail.overview ?? "")),
    practical: pickPractical(introItem),
    homepage: homepageMatch ? homepageMatch[0] : null,
    images,
  };
}

async function main() {
  const media: Record<string, SpotMedia> = {};
  const skipped: string[] = [];
  const noPhoto: string[] = [];

  for (const [index, spot] of SPOTS.entries()) {
    const contentId = resolveContentId(spot);
    if (!contentId) {
      skipped.push(spot.name);
      console.log(`${index + 1}/${SPOTS.length} ${spot.name} — 매칭 없음, 건너뜀`);
      continue;
    }

    const result = await fetchMedia(contentId);
    if (!result) {
      skipped.push(spot.name);
      console.log(`${index + 1}/${SPOTS.length} ${spot.name} — 조회 실패 (${contentId})`);
      continue;
    }

    media[spot.id] = result;
    if (result.images.length === 0) noPhoto.push(spot.name);
    console.log(
      `${index + 1}/${SPOTS.length} ${spot.name} → ${result.sourceTitle} · 사진 ${result.images.length}장 · 이용정보 ${Object.values(result.practical).filter(Boolean).length}개`,
    );
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  writeFileSync("lib/data/spot-media.json", `${JSON.stringify(media, null, 2)}\n`, "utf-8");

  const withPhotos = Object.values(media).filter((m) => m.images.length > 0).length;
  console.log(
    `\n완료: ${Object.keys(media).length}곳 수집 (사진 있음 ${withPhotos}곳) → lib/data/spot-media.json`,
  );
  if (noPhoto.length > 0) console.log(`사진 없음: ${noPhoto.join(", ")}`);
  if (skipped.length > 0) console.log(`제외: ${skipped.join(", ")}`);
}

main();
