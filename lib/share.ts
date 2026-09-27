import type { CardStyle } from "./cardStyle";
import type { MonthCell, Season, Sketch, SketchDot, SketchShapes } from "./sketch";
import type { YearStory } from "./sketchStory";
import { collagePicks } from "./collage";

/*
  한 장으로 보기를 링크로 보여 주기.

  링크를 만들 때 그 순간의 모습을 베껴 둔다(스냅샷). 남이 보는 페이지는
  이 베낀 것만 읽는다 — 여행 기록 표에는 닿지 않는다. 그래서 무엇을
  보여 줄지는 **베낄 때** 정한다. 화면에서 가리는 것이 아니라, 고르지
  않은 것은 처음부터 베낀 것에 들어가지 않는다.

    사진까지   카드·그해 이야기·사진·곳 이름
    지도만     사진을 뺀 나머지
    시도 이름만 어느 시도를 다녔는지와 숫자만. 좌표도 곳 이름도 없다.

  어느 범위에서도 싣지 않는 것:
    - 함께한 사람의 이름. 그 사람은 공개에 동의한 적이 없다.
    - 날짜. 달까지만 남긴다. "8월 13일에 집을 비웠다"는 남이 알 일이 아니다.
    - 여행 id. 남에게는 열리지 않는 주소다.
  좌표는 소수 둘째 자리(약 1km)로 뭉갠다. 전국이나 권역을 그리는 데는
  그걸로 넉넉하고, 집 앞 골목까지 알려 줄 이유는 없다.

  이 파일은 셈만 한다. 올리고 지우는 일은 lib/supabase/shares.ts 가 한다.
*/

export type ShareScope = "photos" | "map" | "sido";

export const SHARE_SCOPES: { id: ShareScope; label: string; hint: string }[] = [
  { id: "photos", label: "사진까지", hint: "카드와 그해 이야기, 사진과 다녀온 곳 이름까지 보여요." },
  { id: "map", label: "지도만", hint: "사진은 빼고, 다닌 길과 다녀온 곳 이름만 보여요." },
  { id: "sido", label: "시도 이름만", hint: "어느 시도를 다녔는지와 숫자만. 정확한 곳과 사진은 보이지 않아요." },
];

/** 링크에 그리는 카드. 시도 이름만일 때는 좌표가 없어 시도를 칠한 지도로 그린다. */
export type ShareCard = CardStyle | "sido";

/** 사진을 가장 많이 얹는 카드(지도형)의 자리 수. SketchShowcase 와 맞춘다. */
export const SHARE_PHOTO_LIMIT = 12;

export interface ShareStats {
  tripCount: number;
  placeCount: number;
  photoCount: number;
  distanceKm: number;
  spanDays: number;
  curatedCount: number;
}

export interface ShareDot {
  lat: number;
  lng: number;
  placeName: string;
  photoCount: number;
  season: Season;
  /** 마지막으로 간 달("2026-08"). 날짜는 싣지 않는다. 콜라주 칸 차례에 쓴다. */
  month: string;
  /** 링크 보관함 속 파일 이름. 사진을 싣지 않으면 null. */
  photo: string | null;
}

export interface SharePath {
  season: Season;
  points: { lat: number; lng: number }[];
}

export interface ShareStory {
  seasons: { season: Season; trips: number }[];
  seasonLine: string | null;
  distanceWords: string | null;
  sido: string[];
  firstSido: string[] | null;
  topPlace: { placeName: string; photoCount: number; photo: string | null } | null;
  compare: { previousYear: number; tripsLine: string; photosLine: string | null } | null;
  /** 그해의 사진. 파일 이름. */
  photos: string[];
}

export interface ShareSnapshot {
  v: 1;
  year: number;
  scope: ShareScope;
  card: ShareCard;
  headline: string;
  stats: ShareStats;
  months: MonthCell[];
  dots: ShareDot[];
  paths: SharePath[];
  story: ShareStory;
  /** 링크 보관함에 올린 사진 파일들. 끊을 때 이것을 지운다. */
  files: string[];
  /** 링크 미리보기 그림(og:image). 못 만들었으면 null. */
  cover: string | null;
}

/** 약 1km. 전국·권역을 그리기에 넉넉하고, 골목까지는 알려 주지 않는다. */
const blur = (n: number) => Math.round(n * 100) / 100;

/** 사진까지일 때 올릴 사진들. 카드와 장면에 쓰이는 것을 모아, 겹치지 않게. */
export function sharePhotoPaths(shapes: SketchShapes, story: YearStory, max = SHARE_PHOTO_LIMIT): string[] {
  const byCount = shapes.dots
    .filter((dot) => dot.photoPath)
    .sort((a, b) => b.photoCount - a.photoCount)
    .map((dot) => dot.photoPath!);
  const wanted = [
    story.topPlace?.photoPath ?? null,
    ...story.photoPaths,
    ...collagePicks(shapes.dots).map((dot) => dot.photoPath),
    ...byCount,
  ];
  return [...new Set(wanted.filter((path): path is string => !!path))].slice(0, max);
}

/** 이 범위로 고른 카드 모양을 그릴 수 있는가. 사진이 없으면 콜라주는 지도로. */
export function shareCardOf(scope: ShareScope, style: CardStyle): ShareCard {
  if (scope === "sido") return "sido";
  if (scope === "map" && style === "collage") return "map";
  return style;
}

export interface SnapshotInput {
  year: number;
  scope: ShareScope;
  style: CardStyle;
  headline: string;
  sketch: Sketch;
  shapes: SketchShapes;
  months: MonthCell[];
  story: YearStory;
  /** 원본 보관 경로 → 링크 보관함 파일 이름. 사진까지일 때만 쓴다. */
  files: Map<string, string>;
  cover: string | null;
}

/** 고른 범위만 남긴 스냅샷. */
export function buildSnapshot(input: SnapshotInput): ShareSnapshot {
  const { scope, sketch, shapes, story } = input;
  const withPhotos = scope === "photos";
  const withPlaces = scope !== "sido";
  const fileOf = (path: string | null | undefined) =>
    withPhotos && path ? (input.files.get(path) ?? null) : null;

  const topPlace: SketchDot | null = withPlaces ? story.topPlace : null;
  const photos = withPhotos
    ? story.photoPaths.map((path) => fileOf(path)).filter((file): file is string => !!file)
    : [];

  return {
    v: 1,
    year: input.year,
    scope,
    card: shareCardOf(scope, input.style),
    headline: input.headline,
    stats: {
      tripCount: sketch.tripCount,
      placeCount: sketch.placeCount,
      photoCount: sketch.photoCount,
      distanceKm: Math.round(sketch.distanceKm * 10) / 10,
      spanDays: sketch.spanDays,
      curatedCount: sketch.curatedCount,
    },
    months: input.months.map((cell) => ({ month: cell.month, tripCount: cell.tripCount, season: cell.season })),
    dots: withPlaces
      ? shapes.dots.map((dot) => ({
          lat: blur(dot.lat),
          lng: blur(dot.lng),
          placeName: dot.placeName,
          photoCount: dot.photoCount,
          season: dot.season,
          month: dot.lastVisitedOn.slice(0, 7),
          photo: fileOf(dot.photoPath),
        }))
      : [],
    paths: withPlaces
      ? shapes.paths.map((path) => ({
          season: path.season,
          points: path.points.map((point) => ({ lat: blur(point.lat), lng: blur(point.lng) })),
        }))
      : [],
    story: {
      seasons: story.seasons,
      seasonLine: story.seasonLine,
      distanceWords: story.distanceWords,
      sido: story.sido,
      firstSido: story.firstSido,
      topPlace: topPlace
        ? { placeName: topPlace.placeName, photoCount: topPlace.photoCount, photo: fileOf(topPlace.photoPath) }
        : null,
      compare: story.compare,
      photos,
    },
    files: withPhotos ? [...new Set(input.files.values())] : [],
    cover: input.cover,
  };
}

/*
  스냅샷을 카드와 장면이 받는 모양으로 되돌린다. 카드는 원래 내 기록을
  그리던 것이라 여행 id·날짜 같은 칸이 있는데, 스냅샷에는 없으니 비워
  둔다. 비운 칸은 카드가 링크를 걸지 않는 것으로 받는다.
*/

export function shapesOfShare(snapshot: ShareSnapshot): SketchShapes {
  return {
    dots: snapshot.dots.map((dot) => ({
      lat: dot.lat,
      lng: dot.lng,
      placeName: dot.placeName,
      lastVisitedOn: dot.month,
      photoPath: dot.photo,
      photoCount: dot.photoCount,
      season: dot.season,
      tripId: "",
    })),
    paths: snapshot.paths.map((path, index) => ({ tripId: String(index), season: path.season, points: path.points })),
  };
}

export function storyOfShare(snapshot: ShareSnapshot): YearStory {
  const { story, stats } = snapshot;
  return {
    year: snapshot.year,
    tripCount: stats.tripCount,
    placeCount: stats.placeCount,
    photoCount: stats.photoCount,
    distanceKm: Math.round(stats.distanceKm),
    distanceWords: story.distanceWords,
    topPlace: story.topPlace
      ? {
          lat: NaN,
          lng: NaN,
          placeName: story.topPlace.placeName,
          lastVisitedOn: "",
          photoPath: story.topPlace.photo,
          photoCount: story.topPlace.photoCount,
          season: "봄",
          tripId: "",
        }
      : null,
    seasons: story.seasons,
    seasonLine: story.seasonLine,
    photoPaths: story.photos,
    sido: story.sido,
    firstSido: story.firstSido,
    compare: story.compare,
    companions: [],
  };
}

/** 링크 id. 짐작해서 찾아올 수 없게 128비트를 URL 에 쓸 수 있는 글자로. */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 링크 id 로 쓸 수 있는 글자인가. 표의 check 와 같다. */
export function isShareId(value: string): boolean {
  return /^[A-Za-z0-9_-]{16,64}$/.test(value);
}

/**
 * 내려받은 스냅샷이 이 화면이 아는 모양인가. 모르는 판이면 그리지 않는다.
 *
 * 스냅샷은 만든 사람의 브라우저가 적은 것이다. 모양이 틀리면 페이지가
 * 그리다 넘어지므로, 그리는 데 쓰는 칸은 다 확인한다.
 */
export function isSnapshot(value: unknown): value is ShareSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ShareSnapshot>;
  const story = snapshot.story as Partial<ShareStory> | undefined;
  const stats = snapshot.stats as Partial<ShareStats> | undefined;
  const texts = (list: unknown) => Array.isArray(list) && list.every((item) => typeof item === "string");
  return (
    snapshot.v === 1 &&
    typeof snapshot.year === "number" &&
    typeof snapshot.headline === "string" &&
    ["photos", "map", "sido"].includes(String(snapshot.scope)) &&
    ["map", "collage", "line", "sido"].includes(String(snapshot.card)) &&
    Array.isArray(snapshot.dots) &&
    Array.isArray(snapshot.paths) &&
    Array.isArray(snapshot.months) &&
    texts(snapshot.files) &&
    (snapshot.cover === null || typeof snapshot.cover === "string") &&
    !!stats &&
    typeof stats.tripCount === "number" &&
    typeof stats.placeCount === "number" &&
    typeof stats.photoCount === "number" &&
    typeof stats.distanceKm === "number" &&
    !!story &&
    Array.isArray(story.seasons) &&
    texts(story.sido) &&
    texts(story.photos) &&
    (story.firstSido === null || texts(story.firstSido))
  );
}
