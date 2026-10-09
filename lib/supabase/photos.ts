import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MARKER_EDGE,
  markerFromBlob,
  reshrink,
  shrinkToWebp,
  THUMB_EDGE,
  thumbFromBlob,
  UnsupportedImageError,
  type Shrunk,
} from "@/lib/photo/resize";
import { removeCopiesOfPhoto } from "./postcardCleanup";

export const BUCKET = "trip-photos";
/*
  사진 파일은 이름이 무작위(uuid)라 한 번 올리면 바뀌지 않는다. 브라우저가
  하루 동안 가지고 있어도 된다 — 서명 주소의 수명과 같다.
*/
const IMMUTABLE_CACHE = String(24 * 60 * 60);
/*
  파일 이름은 늘 .webp 지만 속은 JPEG 일 수 있다 — WebP 를 굽지 못하는
  브라우저(아이폰 사파리)에서 올린 것이다(lib/photo/resize.ts 의 encode).
  이름은 판을 찾는 규칙에만 쓰이니 그대로 두고, 보내는 형식은 실제 것을 붙인다.
*/
const typeOf = (blob: Blob) => (blob.type.startsWith("image/") ? blob.type : "image/webp");
/**
 * 한꺼번에 망에 띄울 장 수.
 *
 * 나란히 떠 있는 것은 줄여 놓은 300KB 짜리뿐이라 메모리는 문제가 아니다.
 * 걸리는 것은 망이다 — HTTP/1.1 브라우저가 한 곳에 여는 연결이 여섯이라,
 * 그보다 늘리면 줄을 서기만 하고 빨라지지 않는다. 약한 망에서 한꺼번에
 * 많이 밀어 넣으면 오히려 끊긴다.
 *
 * 펼친 원본이 50MB 를 잡는 문제는 여기가 아니라 줄이기를 한 장씩 하는
 * 것으로 막는다 (uploadPhotos 참고).
 */
export const UPLOAD_LANES = 6;
/** 계정당 사진 수 상한. 비용이 걷잡을 수 없이 늘지 않게 한다. */
export const PHOTO_LIMIT = 2000;

/** 한 장이 어느 방문의 어느 사진인가 — 올릴 때 표에 적는 것. */
interface PhotoPlace {
  visitId: string;
  takenAt: Date;
  lat: number;
  lng: number;
  isCover: boolean;
}

/** 파일을 줄여서 올릴 사진. */
export interface UploadTarget extends PhotoPlace {
  file: File;
}

/**
 * 이미 올릴 크기로 줄여 맡겨 둔 사진(로그인하러 떠나기 전에 준비해 둔 것, lib/photo/stash). 파일이 아니라 사진 id(열쇠)로
 * 찾는다 — 로그인하고 돌아오면 고른 파일은 사라지고 맡겨 둔 사진만 남아 있다.
 */
export interface PreparedTarget extends PhotoPlace {
  shotId: string;
}

export interface UploadOutcome {
  uploaded: number;
  unsupported: string[];
  failed: number;
  /** 상한에 걸려 올리지 못한 수. */
  overLimit: number;
}

/*
  벽시계 시각. timestamptz 가 아니라 timestamp 칸에 넣으므로
  toISOString 을 쓰면 오전 사진이 전날로 밀린다.
*/
function wallClock(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export async function countPhotos(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("trip_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  return error ? 0 : (count ?? 0);
}

/*
  목록용 판은 보관 경로 옆에 나란히 둔다.

  표에 칸을 더하지 않는 것은, 경로가 규칙으로 정해져 있으면 줄을 고치지
  않고도 있는지 없는지 물어볼 수 있기 때문이다. 아직 없는 예전 사진은
  주소를 달라고 해도 안 오고, 그때는 원본으로 물러난다.

  이름에 크기를 박아 둔다(.t960.webp). 나중에 크기를 바꾸면 이름이
  달라지므로, "없다"는 답이 곧 "다시 만들어야 한다"는 뜻이 된다 —
  따로 표를 뒤지거나 기억해 둘 필요가 없다.
*/
const SIZED = /\.t\d+\.webp$/i;
/** 크기를 이름에 넣기 전에 쓰던 이름. 다시 만든 뒤 지운다. */
const LEGACY = ".thumb.webp";

/** 보관 경로 옆에 크기를 박은 판의 경로. 두 번 걸어도 겹치지 않는다. */
function sizedPath(storagePath: string, edge: number): string {
  if (SIZED.test(storagePath)) return storagePath;
  return storagePath.replace(/\.webp$/i, `.t${edge}.webp`);
}

/** 목록에 쓸 판. */
export function thumbPath(storagePath: string): string {
  return sizedPath(storagePath, THUMB_EDGE);
}

/** 지도 핀에 쓸 판. */
export function markerPath(storagePath: string): string {
  return sizedPath(storagePath, MARKER_EDGE);
}

/** 예전 이름. 낡은 판을 치우는 데만 쓴다. */
export function legacyThumbPath(storagePath: string): string {
  if (storagePath.endsWith(LEGACY)) return storagePath;
  return storagePath.replace(/\.webp$/i, LEGACY);
}

/** 한 장의 결말. 나란히 끝나도 세는 순서가 흔들리지 않게 자리에 담아 둔다. */
type Slot =
  | { kind: "uploaded" }
  | { kind: "failed" }
  | { kind: "overLimit" }
  | { kind: "unsupported"; name: string };

/**
 * 줄여 둔 한 장을 보관함에 올리고 표에 잇는다.
 *
 * 보관함에 먼저 올리고 표에 넣는다. 표 넣기가 실패하면 방금 올린 파일을
 * 지운다 — 아무도 가리키지 않는 파일이 용량만 차지하고 남지 않는다.
 */
async function putOne(
  supabase: SupabaseClient,
  userId: string,
  target: PhotoPlace,
  shrunk: Shrunk,
): Promise<Slot> {
  // 맨 앞 칸이 사용자 id 라야 보관함 정책이 남의 폴더를 막아 준다.
  const path = `${userId}/${target.visitId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, shrunk.full, { contentType: typeOf(shrunk.full), upsert: false, cacheControl: IMMUTABLE_CACHE });

  if (uploadError) return { kind: "failed" };

  /*
    작은 판은 없어도 사진은 사진이다. 실패해도 여기서 멈추지 않는다 —
    목록이 원본으로 물러날 뿐이고, 기록을 잃는 것보다는 낫다.
  */
  await supabase.storage
    .from(BUCKET)
    .upload(thumbPath(path), shrunk.thumb, { contentType: typeOf(shrunk.thumb), upsert: false, cacheControl: IMMUTABLE_CACHE });
  await supabase.storage
    .from(BUCKET)
    .upload(markerPath(path), shrunk.marker, { contentType: typeOf(shrunk.marker), upsert: false, cacheControl: IMMUTABLE_CACHE });

  const { error: rowError } = await supabase.from("trip_photos").insert({
    visit_id: target.visitId,
    user_id: userId,
    storage_path: path,
    taken_at: wallClock(target.takenAt),
    lat: target.lat,
    lng: target.lng,
    is_cover: target.isCover,
  });

  if (rowError) {
    // 아무도 가리키지 않는 파일을 남기지 않는다. 작은 판들도 함께.
    await supabase.storage.from(BUCKET).remove([path, thumbPath(path), markerPath(path)]);
    return { kind: "failed" };
  }

  return { kind: "uploaded" };
}

/**
 * 사진을 줄여 올리고 기록에 잇는다.
 *
 * 한 장씩 차례로 올리면 200장에 3~7분이 걸린다. 줄이기(기기)와
 * 올리기(망)는 서로 기다릴 이유가 없으므로, 한 장을 줄이는 동안 앞서
 * 줄여 둔 것들이 망을 타고 간다.
 */
export function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  targets: UploadTarget[],
  onProgress?: (done: number, total: number, elapsedMs: number) => void,
): Promise<UploadOutcome> {
  return uploadEach(supabase, userId, targets, (target) => shrinkToWebp(target.file), (target) => target.file.name, onProgress);
}

/**
 * 이미 줄여 맡겨 둔 사진을 올린다(lib/photo/stash). 같은 올리기 몸통을 쓰되 줄이는 대신 맡겨 둔 것을 꺼내 온다 —
 * 한 장씩 꺼내므로(펼친 것이 둘 이상 살아 있지 않게 하는 규칙 그대로) 맡긴 사진 전부가 메모리에 오르지 않는다.
 * 꺼낼 수 없는 사진(줄이지 못했던 것)은 '올리지 못한 사진'(unsupported)으로 센다.
 */
export function uploadPrepared(
  supabase: SupabaseClient,
  userId: string,
  targets: PreparedTarget[],
  load: (shotId: string) => Promise<Shrunk | null>,
  onProgress?: (done: number, total: number, elapsedMs: number) => void,
): Promise<UploadOutcome> {
  return uploadEach(
    supabase,
    userId,
    targets,
    async (target) => {
      const shrunk = await load(target.shotId);
      if (!shrunk) throw new UnsupportedImageError(target.shotId);
      return shrunk;
    },
    (target) => target.shotId,
    onProgress,
  );
}

async function uploadEach<T extends PhotoPlace>(
  supabase: SupabaseClient,
  userId: string,
  targets: T[],
  /** 한 장을 올릴 크기로 만든다(파일을 줄이거나, 맡겨 둔 것을 꺼내 온다). 못 만들면 던진다. */
  shrinkOf: (target: T) => Promise<Shrunk>,
  /** 올리지 못한 사진을 알릴 이름. */
  nameOf: (target: T) => string,
  onProgress?: (done: number, total: number, elapsedMs: number) => void,
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: 0, unsupported: [], failed: 0, overLimit: 0 };
  if (targets.length === 0) return outcome;

  // 얼마나 걸리는지는 올리는 쪽이 안다. 화면이 시계를 들고 있을 일이 아니다.
  const startedAt = Date.now();

  const already = await countPhotos(supabase, userId);
  /*
    상한 자리는 올리기 시작할 때 잡고, 실패하면 돌려준다. 다 끝난 뒤에
    빼면 나란히 뜬 네 장이 같은 한 자리를 보고 상한을 넘어선다.
  */
  const quota = { left: Math.max(0, PHOTO_LIMIT - already) };

  const slots: (Slot | undefined)[] = new Array(targets.length);
  const flying = new Map<number, Promise<void>>();
  let done = 0;

  const finish = (index: number, slot: Slot) => {
    slots[index] = slot;
    done += 1;
    onProgress?.(done, targets.length, Date.now() - startedAt);
  };

  onProgress?.(0, targets.length, 0);

  for (const [index, target] of targets.entries()) {
    if (quota.left <= 0) {
      finish(index, { kind: "overLimit" });
      continue;
    }

    // 펼친 그림이 한 번에 하나만 살아 있도록 여기서 기다린다.
    let shrunk: Shrunk;
    try {
      shrunk = await shrinkOf(target);
    } catch (error) {
      finish(
        index,
        error instanceof UnsupportedImageError
          ? { kind: "unsupported", name: nameOf(target) }
          : { kind: "failed" },
      );
      continue;
    }

    quota.left -= 1;

    const fly = async () => {
      try {
        const slot = await putOne(supabase, userId, target, shrunk);
        if (slot.kind !== "uploaded") quota.left += 1;
        finish(index, slot);
      } finally {
        // 제 자리는 스스로 비운다. 아래 race 가 이미 끝난 것을 붙들지 않게.
        flying.delete(index);
      }
    };

    flying.set(index, fly());
    if (flying.size >= UPLOAD_LANES) await Promise.race(flying.values());
  }

  await Promise.all(flying.values());

  // 끝난 차례가 아니라 사진 차례대로 센다.
  for (const slot of slots) {
    if (!slot) continue;
    if (slot.kind === "uploaded") outcome.uploaded += 1;
    else if (slot.kind === "failed") outcome.failed += 1;
    else if (slot.kind === "overLimit") outcome.overLimit += 1;
    else outcome.unsupported.push(slot.name);
  }

  onProgress?.(targets.length, targets.length, Date.now() - startedAt);
  return outcome;
}

/*
  서명 주소의 수명. 하루.

  처음엔 한 시간이었다. 그런데 지도나 한장 요약를 열어 둔 채 폰을
  덮었다가 한참 뒤 다시 보면 사진이 모두 깨져 있었다 — 주소가 그새
  죽은 것이다. 새로 고치기 전에는 되살아나지 않는다.

  하루면 "열어 두고 저녁에 다시 보기"가 된다. 대신 주소가 새어 나가면
  하루 동안은 볼 수 있다. 주소는 긴 무작위 서명이라 짐작할 수 없고,
  남에게 보여 줄 사진은 따로 옮겨 두는 링크 공유(shared-sketches)를 쓴다.
*/
export const SIGNED_URL_SECONDS = 24 * 60 * 60;

/*
  받아 둔 서명 주소를 다시 쓴다.

  서명 주소는 받을 때마다 글자가 달라진다. 브라우저는 주소가 다르면
  같은 사진이어도 새로 내려받는다 — 목록에서 상세로 갔다 돌아오기만 해도
  같은 사진 수십 장을 또 받았다. 내려받는 양(egress)이 무료 한도를 넘은
  까닭이 이것이었다. 한 번 받은 주소를 이 탭이 살아 있는 동안 다시 쓰면,
  주소가 같으니 브라우저가 가진 것을 그대로 보여 준다.

  탭 저장소(sessionStorage)에 둔다. 탭을 닫으면 사라진다 — 같이 쓰는
  기기에 내 사진 주소를 오래 남기지 않는다. 수명이 두 시간 넘게 남은
  것만 다시 쓴다.
*/
const REUSE_MARGIN_MS = 2 * 60 * 60 * 1000;
const SIGNED_STORE = "signed-urls:v1";
let signedMemo: Map<string, { url: string; until: number }> | null = null;

function memoOf(): Map<string, { url: string; until: number }> {
  if (signedMemo) return signedMemo;
  signedMemo = new Map();
  try {
    const raw = window.sessionStorage.getItem(SIGNED_STORE);
    if (raw) for (const [path, entry] of Object.entries(JSON.parse(raw))) signedMemo.set(path, entry as { url: string; until: number });
  } catch {
    // 저장소를 못 쓰면 이번 화면 동안만 기억한다.
  }
  return signedMemo;
}

function keepMemo(memo: Map<string, { url: string; until: number }>, now: number) {
  for (const [path, entry] of memo) if (entry.until - now <= REUSE_MARGIN_MS) memo.delete(path);
  try {
    window.sessionStorage.setItem(SIGNED_STORE, JSON.stringify(Object.fromEntries(memo)));
  } catch {
    // 가득 찼거나 막혔으면 이번 화면 동안만 기억한다.
  }
}

/** 받아 둔 주소를 잊는다. 시험과 로그아웃에 쓴다. */
export function forgetSignedUrls(): void {
  signedMemo = new Map();
  try {
    window.sessionStorage.removeItem(SIGNED_STORE);
  } catch {
    // 막혔으면 할 일이 없다.
  }
}

/**
 * 볼 수 있는 주소를 만든다.
 *
 * 버킷이 비공개라 고정 주소가 없다. 수명이 정해진 서명 주소를 받는다
 * (SIGNED_URL_SECONDS). 기본 수명으로 받는 것은 받아 둔 것을 다시 쓴다 —
 * 있는지 물어보려고 짧게 받는 것(missingThumbs 등)은 늘 새로 묻는다.
 */
export async function signedUrls(
  supabase: SupabaseClient,
  paths: string[],
  seconds = SIGNED_URL_SECONDS,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const reuse = seconds === SIGNED_URL_SECONDS && typeof window !== "undefined";
  const memo = reuse ? memoOf() : null;
  const now = Date.now();
  const wanted: string[] = [];
  for (const path of paths) {
    const kept = memo?.get(path);
    if (kept && kept.until - now > REUSE_MARGIN_MS) urls.set(path, kept.url);
    else wanted.push(path);
  }
  if (wanted.length === 0) return urls;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, seconds);
  if (error || !data) return urls;

  for (const item of data) {
    if (!item.path || !item.signedUrl) continue;
    urls.set(item.path, item.signedUrl);
    memo?.set(item.path, { url: item.signedUrl, until: now + seconds * 1000 });
  }
  if (memo) keepMemo(memo, now);
  return urls;
}

/**
 * 방문마다 대표로 쓸 사진 한 장.
 *
 * 스케치 지도에 점 대신 사진을 얹는 데 쓴다. 방문마다 첫 장을 고른다 —
 * 도착해서 찍은 것이 그곳을 가장 잘 말해 준다.
 *
 * "방문마다 한 줄"을 SQL 로 뽑는 길이 마땅치 않아 경로만 통째로 받아
 * 여기서 추린다. 경로 하나가 60바이트 남짓이라 500장이어야 30KB 다.
 * 수천 장이 쌓이면 그때 다시 볼 일이다.
 */
export async function visitCovers(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("trip_photos")
    .select("visit_id,storage_path")
    .eq("user_id", userId)
    .order("taken_at", { ascending: true });

  if (error || !data) return new Map();

  const first = new Map<string, string>();
  for (const row of data) {
    const visitId = String(row.visit_id);
    if (!first.has(visitId)) first.set(visitId, String(row.storage_path));
  }
  return first;
}

/**
 * 목록에 쓸 작은 판의 주소.
 *
 * 작은 판이 아직 없는 사진(썸네일을 붙이기 전에 올라간 것들)은 원본
 * 주소로 물러난다. 돌려주는 map 의 열쇠는 언제나 **원본 경로**라,
 * 부르는 쪽은 무엇이 왔는지 신경 쓰지 않아도 된다.
 */
export async function thumbUrls(
  supabase: SupabaseClient,
  paths: string[],
  seconds = SIGNED_URL_SECONDS,
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const small = await signedUrls(supabase, paths.map(thumbPath), seconds);

  const urls = new Map<string, string>();
  const missing: string[] = [];
  for (const path of paths) {
    const hit = small.get(thumbPath(path));
    if (hit) urls.set(path, hit);
    else missing.push(path);
  }

  if (missing.length > 0) {
    const big = await signedUrls(supabase, missing, seconds);
    for (const [path, url] of big) urls.set(path, url);
  }
  return urls;
}

/**
 * 지도 핀에 쓸 판의 주소.
 *
 * 핀 판이 아직 없으면 목록 판으로, 그것도 없으면 원본으로 물러난다.
 * 열쇠는 thumbUrls 와 같이 언제나 원본 경로다.
 */
export async function markerUrls(
  supabase: SupabaseClient,
  paths: string[],
  seconds = SIGNED_URL_SECONDS,
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const tiny = await signedUrls(supabase, paths.map(markerPath), seconds);

  const urls = new Map<string, string>();
  const missing: string[] = [];
  for (const path of paths) {
    const hit = tiny.get(markerPath(path));
    if (hit) urls.set(path, hit);
    else missing.push(path);
  }

  if (missing.length > 0) {
    for (const [path, url] of await thumbUrls(supabase, missing, seconds)) urls.set(path, url);
  }
  return urls;
}

/** 한 곳에서 찍은 사진 한 장. */
export interface PlacePhoto {
  id: string;
  visitId: string;
  storagePath: string;
  /** "2026-09-14 06:11:00" 꼴의 벽시계 시각. */
  takenAt: string;
}

/**
 * 지도에서 고른 곳의 사진들. 찍은 순서대로.
 *
 * 핀을 누를 때마다 그곳 것만 받는다. 전부를 미리 받아 두면 지도를 여는
 * 것만으로 수백 장의 주소를 만들어야 한다.
 */
export async function fetchPlacePhotos(
  supabase: SupabaseClient,
  userId: string,
  visitIds: string[],
): Promise<PlacePhoto[]> {
  if (visitIds.length === 0) return [];
  const { data, error } = await supabase
    .from("trip_photos")
    .select("id,visit_id,storage_path,taken_at")
    .eq("user_id", userId)
    .in("visit_id", visitIds)
    .order("taken_at", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    visitId: String(row.visit_id),
    storagePath: String(row.storage_path),
    takenAt: String(row.taken_at),
  }));
}

/*
  뒤늦게 작은 판 챙기기.

  썸네일을 붙이기 전에 올라간 사진들은 목록에서 원본을 통째로 내려받는다.
  한 번 훑어 작은 판을 만들어 두면 그 뒤로는 안 그런다. 사진이 적을 때
  하는 편이 싸다 — 나중엔 올라간 것 전부를 뒤져야 한다.
*/

/** 작은 판이 아직 없는 사진들의 보관 경로. */
export async function missingThumbs(
  supabase: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("trip_photos")
    .select("storage_path")
    .eq("user_id", userId);

  if (error || !data) return [];
  const paths = data.map((row) => String(row.storage_path));
  if (paths.length === 0) return [];

  /*
    판이 하나라도 빠졌으면 챙길 대상이다. 목록 판과 핀 판을 한 번에
    물어본다 — 이름이 규칙으로 정해져 있어 따로 적어 둔 표가 필요 없다.
  */
  const small = await signedUrls(supabase, [...paths.map(thumbPath), ...paths.map(markerPath)], 60);
  return paths.filter((path) => !small.has(thumbPath(path)) || !small.has(markerPath(path)));
}

export interface BackfillOutcome {
  made: number;
  failed: number;
}

/**
 * 빠진 작은 판을 만들어 올린다.
 *
 * 목록 판이 있으면 그것을 받아 핀 판만 만든다. 목록 판(87KB)에서 만들면
 * 원본(400KB)을 다시 받지 않아도 된다 — 507장이면 200MB 와 44MB 의
 * 차이고, 내려받는 양은 곧 청구서다. 목록 판이 없을 때만 원본을 받아
 * 둘 다 만든다.
 *
 * 한 장씩 차례로 한다. 펼친 그림이 한 번에 하나만 살아 있게 하는 것도
 * 있지만, 무엇보다 한 번 하고 마는 일이라 빠를 이유가 없다.
 */
export async function backfillThumbs(
  supabase: SupabaseClient,
  paths: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<BackfillOutcome> {
  const outcome: BackfillOutcome = { made: 0, failed: 0 };
  onProgress?.(0, paths.length);

  const put = async (path: string, blob: Blob) => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: typeOf(blob), upsert: true });
    if (error) throw new Error("upload failed");
  };

  for (const [index, path] of paths.entries()) {
    try {
      const urls = await signedUrls(supabase, [thumbPath(path), path], 120);
      const thumbUrl = urls.get(thumbPath(path));

      if (thumbUrl) {
        const response = await fetch(thumbUrl);
        if (!response.ok) throw new Error("fetch failed");
        await put(markerPath(path), await markerFromBlob(await response.blob(), path));
      } else {
        const url = urls.get(path);
        if (!url) throw new Error("no url");
        const response = await fetch(url);
        if (!response.ok) throw new Error("fetch failed");
        const original = await response.blob();

        await put(thumbPath(path), await thumbFromBlob(original, path));
        await put(markerPath(path), await markerFromBlob(original, path));

        /*
          새 판이 올라간 뒤에야 낡은 판을 치운다. 순서가 바뀌면 중간에
          끊겼을 때 아무 판도 없는 사진이 생긴다.
        */
        await supabase.storage.from(BUCKET).remove([legacyThumbPath(path)]);
      }
      outcome.made += 1;
    } catch {
      // 한 장 실패했다고 나머지를 포기하지 않는다. 다음에 다시 하면 된다.
      outcome.failed += 1;
    }
    onProgress?.(index + 1, paths.length);
  }

  return outcome;
}

/**
 * 사진 한 장을 지운다.
 *
 * 표에서 먼저 지우고 보관함 파일을 지운다. 순서가 중요하다 —
 * 파일을 먼저 지웠다가 표 지우기가 실패하면, 가리키는 파일이 없는 줄이
 * 남아 사용자에게 영영 빈 칸으로 보인다. 반대로 표를 먼저 지우면 최악의
 * 경우 아무도 가리키지 않는 파일이 남는데, 이건 눈에 보이지 않고
 * 나중에 쓸어 담을 수 있다.
 */
export async function deletePhoto(
  supabase: SupabaseClient,
  userId: string,
  photo: { id: string; storagePath: string; visitId: string },
): Promise<boolean> {
  /*
    이 사진에서 나온 엽서 복사본을 먼저 치운다. 원본을 지우면 복사본도 지운다는 약속이고, 복사본의
    파일을 못 지웠으면 원본도 지우지 않는다(줄이 먼저 사라지면 엽서 보관함의 사진이 공개로 남는다).
  */
  if (!(await removeCopiesOfPhoto(supabase, photo.id))) return false;

  const { error } = await supabase
    .from("trip_photos")
    .delete()
    .eq("id", photo.id)
    .eq("user_id", userId);

  if (error) return false;

  await supabase.storage
    .from(BUCKET)
    // 낡은 이름도 함께 치운다. 아직 다시 만들지 않은 사진일 수 있다.
    .remove([
      photo.storagePath,
      thumbPath(photo.storagePath),
      markerPath(photo.storagePath),
      legacyThumbPath(photo.storagePath),
    ]);
  await syncPhotoCount(supabase, userId, photo.visitId);
  return true;
}

/**
 * 방문에 남은 사진 수를 다시 센다.
 *
 * 하나씩 빼는 대신 세어서 맞춘다. 중간에 무엇이 어긋나도 다음 삭제에서
 * 바로잡히고, 실제와 다른 숫자가 쌓이지 않는다.
 */
async function syncPhotoCount(supabase: SupabaseClient, userId: string, visitId: string) {
  const { count, error } = await supabase
    .from("trip_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("visit_id", visitId);

  if (error) return;
  await supabase
    .from("visits")
    .update({ photo_count: count ?? 0 })
    .eq("id", visitId)
    .eq("user_id", userId);
}

/**
 * 목록에 보일 대표 사진을 정한다.
 *
 * 대표였던 사진을 지우면 목록의 썸네일이 비어 버린다. 남은 사진 중
 * 하나를 대신 세운다. 한 여행에 대표는 하나여야 하므로 먼저 모두 내린다.
 */
export async function setCoverPhoto(
  supabase: SupabaseClient,
  userId: string,
  visitIds: string[],
  photoId: string,
): Promise<boolean> {
  if (visitIds.length === 0) return false;

  const cleared = await supabase
    .from("trip_photos")
    .update({ is_cover: false })
    .eq("user_id", userId)
    .in("visit_id", visitIds);

  if (cleared.error) return false;

  const { error } = await supabase
    .from("trip_photos")
    .update({ is_cover: true })
    .eq("id", photoId)
    .eq("user_id", userId);

  return !error;
}

export interface ReshrinkOutcome {
  done: number;
  failed: number;
  /** 다시 구워도 가벼워지지 않아 그대로 둔 수. */
  skipped: number;
  /** 다시 줄이기 전과 뒤, 보관본·목록 판·핀 판을 모두 더한 크기. 줄인 것만 센다. */
  bytesBefore: number;
  bytesAfter: number;
}

/** 다시 줄일 한 장. 지금 보관된 크기를 함께 받아 줄었는지 견준다. */
export interface ReshrinkTarget {
  path: string;
  /** 보관본·목록 판·핀 판을 더한 지금 크기. */
  bytes: number;
}

/** 나란히 다시 줄일 장 수. 한 장이 펼친 그림 16MB 를 잡는다. */
const RESHRINK_LANES = 3;
/** 실패한 것을 다시 해 보는 횟수까지 친 판 수. */
const RESHRINK_ROUNDS = 3;

/**
 * 무거운 사진을 받아 다시 줄여 같은 이름에 덮어쓴다.
 *
 * 이름이 그대로라 표를 고칠 것이 없다. 덮어쓰기는 파일 하나씩 통째로
 * 바뀌므로, 중간에 끊겨도 보관본은 옛것이든 새것이든 온전하다. 다시
 * 살펴보면 아직 무거운 것만 남으니 그대로 이어서 하면 된다.
 *
 * 다시 구운 보관본이 지금보다 크면 건드리지 않는다 — 가볍게 하려는
 * 일이 무겁게 만들면 안 된다.
 */
export async function reshrinkPhotos(
  supabase: SupabaseClient,
  targets: ReshrinkTarget[],
  onProgress?: (done: number, total: number) => void,
  /** 다시 하기 전에 숨 돌리는 시간. 끊긴 망이 돌아올 틈을 준다. */
  retryDelayMs = 3000,
): Promise<ReshrinkOutcome> {
  const outcome: ReshrinkOutcome = { done: 0, failed: 0, skipped: 0, bytesBefore: 0, bytesAfter: 0 };
  onProgress?.(0, targets.length);

  const put = async (path: string, blob: Blob) => {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: typeOf(blob), upsert: true, cacheControl: IMMUTABLE_CACHE });
    if (error) throw new Error("upload failed");
  };

  const one = async ({ path, bytes }: ReshrinkTarget) => {
    const url = (await signedUrls(supabase, [path], 120)).get(path);
    if (!url) throw new Error("no url");
    const response = await fetch(url);
    if (!response.ok) throw new Error("fetch failed");
    const original = await response.blob();

    const shrunk = await reshrink(original, path);
    if (shrunk.full.size >= original.size) {
      outcome.skipped += 1;
      return;
    }

    // 작은 판부터. 보관본이 마지막이라, 끊기면 다음에 다시 무거운 것으로 잡힌다.
    await put(markerPath(path), shrunk.marker);
    await put(thumbPath(path), shrunk.thumb);
    await put(path, shrunk.full);

    outcome.done += 1;
    outcome.bytesBefore += bytes;
    outcome.bytesAfter += shrunk.full.size + shrunk.thumb.size + shrunk.marker.size;
  };

  /*
    실패한 것은 모아 두었다가 다시 한다. 폰 화면이 잠깐 꺼지거나 망이
    끊기면 그동안 뜬 것이 한꺼번에 실패한다 — 그대로 끝내면 사용자가
    살펴보기와 다시 줄이기를 몇 번이고 되풀이해야 했다.
  */
  let pending = targets;
  for (let round = 0; round < RESHRINK_ROUNDS && pending.length > 0; round += 1) {
    if (round > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    const failed: ReshrinkTarget[] = [];
    let next = 0;
    const lane = async () => {
      while (next < pending.length) {
        const target = pending[next++];
        try {
          await one(target);
          // 끝낸 것만 센다. 실패한 것은 다시 해서 끝낼 때 센다.
          onProgress?.(outcome.done + outcome.skipped, targets.length);
        } catch {
          // 한 장 실패했다고 나머지를 멈추지 않는다. 이 판이 끝나면 다시 한다.
          failed.push(target);
        }
      }
    };
    await Promise.all(Array.from({ length: RESHRINK_LANES }, lane));
    pending = failed;
  }
  outcome.failed = pending.length;

  return outcome;
}
