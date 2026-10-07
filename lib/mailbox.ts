import { newInviteToken } from "./family";
import type { FootprintStep } from "./footprint";
import type { TripDetail } from "./supabase/tripDetail";

/*
  가족 책장 — 여행을 기록한 사람이 부모님 같은 가족에게 "엽서"를 보낸다.

  받는 사람은 앱도 로그인도 없이 링크 하나로 엽서를 보고 답장한다. 규칙은 DB(supabase/mailbox.sql)가
  지키고, 여기 있는 것은 화면이 같은 규칙을 알고 셈하는 데 쓰는 순수 함수들이다. 올리고 지우는 일은
  lib/supabase/ 쪽이 한다(링크 공유와 같은 나눔).

    책장  집 한 곳당 하나(부모님 두 분은 한 책장). 보내는 사람은 여럿.
    엽서    보낸 순간 그대로 남는다 — 사진은 한 번만 복사해 두고 책장끼리 같이 쓴다.
    인사말  책장마다 따로. 호칭은 본문과 따로 저장해 맨 앞에만 붙인다.
*/

/** 한 사람이 만들 수 있는 책장. DB 도 같은 수로 막는다. */
export const MAILBOX_LIMIT = 3;
/** 한 책장에 보낼 수 있는 사람(주인 포함). */
export const MAILBOX_SENDER_LIMIT = 8;
/** 책(엽서) 한 권에 싣는 사진의 최대 수. 책장 설정(6·12·20장)이 이 안에서 정한다. */
export const POSTCARD_PHOTOS_MAX = 20;
/** 인사말 본문의 글자 수. */
export const BODY_MAX = 300;
export const NAME_MAX = 40;
export const GREETING_NAME_MAX = 20;
/** 받는 분 이름("엄마") 하나의 글자 수와 책장당 수. */
export const MEMBER_MAX = 10;
export const MEMBERS_MAX = 6;

/** 받는 분이 누르는 답장 단추의 기본 문구. */
export const DEFAULT_REACTIONS = ["좋구나", "잘 다녀왔니", "다음엔 같이 가자"];

export type Tone = "casual" | "polite";

/* ── 링크의 글자 ─────────────────────────────────────────── */

const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;
const POSTCARD_ID = /^[A-Za-z0-9_-]{16,64}$/;

export const isMailboxToken = (value: string): boolean => TOKEN.test(value);
export const isPostcardId = (value: string): boolean => POSTCARD_ID.test(value);

/** 짐작해서 맞힐 수 없는 무작위 글자(256비트). 책장 링크에 들어간다. */
export const newMailboxToken = (): string => newInviteToken();
/** 엽서 주소이자 사진 폴더 이름. 사용자 id 가 드러나지 않는다. */
export const newPostcardId = (): string => newInviteToken();

export const mailboxUrl = (origin: string, token: string): string => `${origin}/m/${token}`;
/** 보내는 사람 초대 주소. 받는 쪽 링크(/m)와 다르다 — 로그인해서 수락하는 길이다. */
export const mailboxInviteUrl = (origin: string, token: string): string => `${origin}/mailboxes/join/${token}`;
export const postcardUrl = (origin: string, token: string, postcardId: string): string =>
  `${origin}/m/${token}/p/${postcardId}`;

/*
  미리보기 — 보내는 사람이 부모님 화면을 미리 보는 길. 같은 화면이지만 "열어 봤다"는 표시도, 답장도, 하트도
  가지 않는다. 주소 끝에 ?preview=1 이 붙고, 화면 안의 길(엽서·책장)에도 그 표시가 이어진다.
  이 표시는 화면이 무엇을 보낼지만 정한다 — 미리보기 주소로 와도 부모님이 볼 수 있는 것 외에는 더 보이지 않는다.
*/
/**
 * 미리보기 방식. true 는 지금 부모님이 보시는 대로(안 열어 본 엽서는 '새 엽서'), "all" 은 모든 엽서를 열어 본 것처럼
 * (책꽂이·작년 오늘·올해의 책을 확인할 수 있다 — 부모님이 열어 본 엽서가 없으면 책꽂이는 비어 있어서).
 */
export type PreviewMode = boolean | "all";
const previewSuffix = (preview: PreviewMode): string => (preview === "all" ? "?preview=all" : preview ? "?preview=1" : "");
/** 받는 쪽 책장 첫 화면의 길. 같은 서비스 안의 길이라 origin 은 붙이지 않는다. */
export const mailboxPath = (token: string, preview: PreviewMode = false): string => `/m/${token}${previewSuffix(preview)}`;
/** 받는 쪽 엽서 한 장의 길. */
export const postcardPath = (token: string, postcardId: string, preview: PreviewMode = false): string =>
  `/m/${token}/p/${postcardId}${previewSuffix(preview)}`;
/** 받는 쪽 올해의 책의 길. */
export const yearBookPath = (token: string, year: string, preview: PreviewMode = false): string =>
  `/m/${token}/year/${year}${previewSuffix(preview)}`;
/** 받는 쪽 '가고 싶은 곳 보내기'의 길. */
export const wishPath = (token: string, preview: PreviewMode = false): string => `/m/${token}/wish${previewSuffix(preview)}`;
/** 주소의 ?preview= 값. 1 은 지금 모습, all 은 모두 열어 본 것처럼, 그 밖은 평소 화면(false). */
export const isPreview = (value: string | string[] | undefined): PreviewMode => (value === "all" ? "all" : value === "1");

/* ── 받는 분 이름 ────────────────────────────────────────── */

/**
 * "엄마, 아빠" → ["엄마", "아빠"]. 받는 쪽 화면이 "누가 보시나요?"에 쓴다.
 * 쉼표·가운뎃점·공백으로 나누고, 겹치는 것과 빈 것은 버리고, 이름은 10자·여섯 명까지.
 */
export function normalizeMembers(text: string): string[] {
  const names = text
    .split(/[,，、·ㆍ\n\s]+/)
    .map((name) => name.trim().slice(0, MEMBER_MAX))
    .filter(Boolean);
  return [...new Set(names)].slice(0, MEMBERS_MAX);
}

/* ── 인사말 ──────────────────────────────────────────────── */

export interface GreetingTarget {
  /** 부르는 말("엄마 아빠"). 인사말 맨 앞에 붙는다. */
  greetingName: string | null;
  /** 맨 앞에 호칭을 붙일지. */
  useGreeting: boolean;
}

/**
 * 받는 쪽에 보이는 인사말. 호칭은 본문과 따로 저장해 맨 앞에만 붙인다 —
 * 본문 안의 "아빠"나 "이모"는 건드리지 않는다. 본문이 비면 호칭만 덩그러니 나가지 않게 빈 글.
 */
export function composeGreeting(target: GreetingTarget, body: string): string {
  const text = body.trim().slice(0, BODY_MAX);
  if (!text) return "";
  const name = target.greetingName?.trim();
  return target.useGreeting && name ? `${name}, ${text}` : text;
}

export interface GreetingRow {
  mailboxId: string;
  /** 이 책장의 본문(복사했거나 직접 고쳤거나). */
  body: string;
  /** 직접 고친 본문인가. 아니면 처음 쓴 것을 따라간다. */
  edited: boolean;
  /** 받는 쪽에 보일 글(호칭 포함). */
  text: string;
}

/**
 * 복사 후 수정. 처음 쓴 본문을 모든 책장에 복사하고, 호칭만 책장 것을 붙인다.
 * overrides 에 있는 책장(직접 고친 것)은 그 글을 쓰고 "고쳤다"고 표시한다. 비우면 다시 따라간다.
 */
export function greetingsFor(
  body: string,
  boxes: (GreetingTarget & { id: string })[],
  overrides: Record<string, string>,
): GreetingRow[] {
  return boxes.map((box) => {
    const own = overrides[box.id];
    const edited = own !== undefined && own.trim() !== "";
    const text = edited ? own : body;
    return { mailboxId: box.id, body: text, edited, text: composeGreeting(box, text) };
  });
}

const SUGGESTIONS: Record<Tone, string[]> = {
  polite: ["건강하시죠?", "조만간 찾아뵐게요.", "날씨가 참 좋았습니다."],
  casual: ["보고 싶어요", "다음엔 같이 가요", "사진이 정말 예뻐요"],
};

/** 말투별 추천 문구. 반말을 존댓말로 자동 변환하지는 않는다 — 어색한 문장이 나오기 쉬워서다. */
export const suggestionsFor = (tone: Tone): string[] => SUGGESTIONS[tone];

/* ── 엽서에 실을 사진 고르기 ────────────────────────────── */

export interface PostcardPhotoCandidate {
  id: string;
  visitId: string;
  takenAt: Date;
  isCover: boolean;
}

/**
 * 엽서에 실을 사진을 자동으로 고른다(바꿀 수 있다).
 *
 * 곳마다 대표 한 장(대표로 정한 것, 없으면 가장 먼저 찍은 것)을 모으고, 곳이 많으면 앞에서부터가
 * 아니라 고르게 흩어 뽑는다. 곳이 모자라면 남는 자리를 곳들을 돌아가며 다른 사진으로 채운다.
 * 결과는 여행에 나온 차례(찍은 때)로 돌려준다.
 */
export function pickPostcardPhotos(photos: PostcardPhotoCandidate[], count = POSTCARD_PHOTOS_MAX): PostcardPhotoCandidate[] {
  const byTime = (a: PostcardPhotoCandidate, b: PostcardPhotoCandidate) =>
    a.takenAt.getTime() - b.takenAt.getTime() || a.id.localeCompare(b.id);
  const sorted = [...photos].sort(byTime);
  if (sorted.length <= count) return sorted;

  // 곳(방문)별로, 처음 나온 차례대로.
  const visits = new Map<string, PostcardPhotoCandidate[]>();
  for (const photo of sorted) visits.set(photo.visitId, [...(visits.get(photo.visitId) ?? []), photo]);
  const groups = [...visits.values()];
  const representative = (group: PostcardPhotoCandidate[]) => group.find((photo) => photo.isCover) ?? group[0];
  const reps = groups.map(representative);

  let picked: PostcardPhotoCandidate[];
  if (reps.length >= count) {
    // 곳이 충분하면 고르게 흩어 뽑는다. 하나만 뽑을 때는 첫 곳.
    picked =
      count === 1
        ? [reps[0]]
        : Array.from({ length: count }, (_, index) => reps[Math.floor((index * (reps.length - 1)) / (count - 1))]);
  } else {
    // 곳이 모자라면 곳마다 한 장을 뽑고, 남는 자리는 곳들을 돌아가며 다른 사진으로 채운다.
    picked = [...reps];
    const rest = groups.map((group) => group.filter((photo) => !picked.includes(photo)));
    for (let round = 0; picked.length < count; round += 1) {
      let added = false;
      for (const list of rest) {
        if (picked.length >= count) break;
        if (list[round]) {
          picked.push(list[round]);
          added = true;
        }
      }
      if (!added) break;
    }
  }
  return picked.sort(byTime);
}

/* ── 엽서 스냅샷(보낸 순간의 모습) ──────────────────────── */

export interface PostcardSnapshotVisit {
  placeName: string;
  lat: number;
  lng: number;
  /** 그곳에 간 날. "2026-09-13". */
  day: string;
  /** 엽서 보관함 속 파일 이름들. */
  photos: string[];
}

export interface PostcardSnapshot {
  v: 1;
  title: string | null;
  startedOn: string;
  endedOn: string;
  visits: PostcardSnapshotVisit[];
  /** 엽서 보관함에 올린 파일들. 지울 때 이것을 지운다. */
  files: string[];
}

/** 약 1km. */
const blur = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
/** 찍힌 그대로의 벽시계 날짜. toISOString 을 쓰면 오전이 전날로 밀린다. */
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * 스냅샷을 짓는다. files 는 원본 보관 경로 → 엽서 보관함 파일 이름이고, 여기에 없는 사진
 * (고르지 않았거나 올리지 못한 것)은 싣지 않는다.
 *
 * 싣지 않는 것: 메모, 함께한 사람, 여행·사진 id, 원본 경로, 찍은 시각, 동 이름.
 * 좌표는 소수 둘째 자리로 흐린다. 링크 공유(lib/tripShare.ts)와 같은 원칙이다.
 */
export function buildPostcardSnapshot(trip: TripDetail, files: Map<string, string>): PostcardSnapshot {
  const visits = trip.visits.map((visit) => ({
    placeName: visit.placeName,
    lat: blur(visit.lat),
    lng: blur(visit.lng),
    day: dayOf(visit.startedAt),
    photos: visit.photos.flatMap((photo) => {
      const file = files.get(photo.storagePath);
      return file ? [file] : [];
    }),
  }));
  return {
    v: 1,
    title: trip.title,
    startedOn: trip.startedOn,
    endedOn: trip.endedOn,
    visits,
    files: visits.flatMap((visit) => visit.photos),
  };
}

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isDay = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
/** 파일 이름은 엽서 폴더 한 칸이다. "../" 같은 것이 섞이지 않게 한다. */
const isFileName = (value: unknown): value is string => isString(value) && /^[A-Za-z0-9._-]{1,80}$/.test(value);

/** 내려받은 것이 이 화면이 아는 스냅샷인가. 보낸 사람의 브라우저가 적은 것이라 쓰는 칸은 다 확인한다. */
export function isPostcardSnapshot(value: unknown): value is PostcardSnapshot {
  if (!value || typeof value !== "object") return false;
  const snap = value as Record<string, unknown>;
  if (snap.v !== 1) return false;
  if (!(snap.title === null || isString(snap.title))) return false;
  if (!isDay(snap.startedOn) || !isDay(snap.endedOn)) return false;
  if (!Array.isArray(snap.files) || snap.files.length > POSTCARD_PHOTOS_MAX || !snap.files.every(isFileName)) return false;
  if (!Array.isArray(snap.visits)) return false;
  return snap.visits.every((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const visit = raw as Record<string, unknown>;
    return (
      isString(visit.placeName) &&
      isNumber(visit.lat) &&
      isNumber(visit.lng) &&
      isDay(visit.day) &&
      Array.isArray(visit.photos) &&
      visit.photos.every(isFileName)
    );
  });
}

/* ── 받는 쪽 화면에 쓰는 말과 점 ─────────────────────────── */

/** 엽서의 제목. 여행에 이름이 없으면 곳 이름으로 짓는다("안목해변 외 2곳"). */
export function postcardTitle(snapshot: PostcardSnapshot): string {
  const title = snapshot.title?.trim();
  if (title) return title;
  const first = snapshot.visits[0]?.placeName;
  if (!first) return "여행 엽서";
  return snapshot.visits.length > 1 ? `${first} 외 ${snapshot.visits.length - 1}곳` : first;
}

/** 엽서의 기간을 말로. "9월 13일", "9월 13일 ~ 14일", 달이 넘어가면 "8월 31일 ~ 9월 1일". */
export function postcardSpan(snapshot: PostcardSnapshot): string {
  const parse = (day: string) => ({ month: Number(day.slice(5, 7)), date: Number(day.slice(8, 10)) });
  const from = parse(snapshot.startedOn);
  const to = parse(snapshot.endedOn);
  if (!(from.month >= 1 && from.month <= 12 && from.date >= 1)) return "";
  const start = `${from.month}월 ${from.date}일`;
  if (snapshot.startedOn === snapshot.endedOn || !(to.month >= 1 && to.month <= 12 && to.date >= 1)) return start;
  return from.month === to.month ? `${start} ~ ${to.date}일` : `${start} ~ ${to.month}월 ${to.date}일`;
}

/**
 * 발자취 재생(FootprintPlayer)에 쓸 점들. 들른 차례 그대로이고, 링크로 받은 것과 같은 모양이라
 * 눌러도 갈 곳이 없다(tripId 가 비어 있다). 날을 못 읽는 곳은 건너뛴다.
 */
export function postcardSteps(snapshot: PostcardSnapshot): FootprintStep[] {
  return snapshot.visits.flatMap((visit) => {
    const month = Number(visit.day.slice(5, 7));
    if (!(month >= 1 && month <= 12)) return [];
    return [
      {
        placeName: visit.placeName,
        lat: visit.lat,
        lng: visit.lng,
        month,
        day: Number(visit.day.slice(8, 10)) || null,
        tripId: "",
        photoCount: visit.photos.length,
        photoPath: visit.photos[0] ?? null,
      },
    ];
  });
}
