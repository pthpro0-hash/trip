import type { SupabaseClient } from "@supabase/supabase-js";
import { shrinkToWebp, UnsupportedImageError } from "@/lib/photo/resize";

export const BUCKET = "trip-photos";
/** 계정당 사진 수 상한. 비용이 걷잡을 수 없이 늘지 않게 한다. */
export const PHOTO_LIMIT = 2000;

export interface UploadTarget {
  visitId: string;
  file: File;
  takenAt: Date;
  lat: number;
  lng: number;
  isCover: boolean;
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

/**
 * 사진을 줄여 올리고 기록에 잇는다.
 *
 * 보관함에 먼저 올리고 표에 넣는다. 표 넣기가 실패하면 방금 올린 파일을
 * 지운다 — 아무도 가리키지 않는 파일이 용량만 차지하고 남지 않는다.
 */
export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  targets: UploadTarget[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: 0, unsupported: [], failed: 0, overLimit: 0 };

  const already = await countPhotos(supabase, userId);
  let room = Math.max(0, PHOTO_LIMIT - already);

  for (const [index, target] of targets.entries()) {
    onProgress?.(index, targets.length);

    if (room <= 0) {
      outcome.overLimit += 1;
      continue;
    }

    let blob: Blob;
    try {
      blob = await shrinkToWebp(target.file);
    } catch (error) {
      if (error instanceof UnsupportedImageError) outcome.unsupported.push(target.file.name);
      else outcome.failed += 1;
      continue;
    }

    // 맨 앞 칸이 사용자 id 라야 보관함 정책이 남의 폴더를 막아 준다.
    const path = `${userId}/${target.visitId}/${crypto.randomUUID()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: "image/webp", upsert: false });

    if (uploadError) {
      outcome.failed += 1;
      continue;
    }

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
      // 아무도 가리키지 않는 파일을 남기지 않는다.
      await supabase.storage.from(BUCKET).remove([path]);
      outcome.failed += 1;
      continue;
    }

    outcome.uploaded += 1;
    room -= 1;
  }

  onProgress?.(targets.length, targets.length);
  return outcome;
}

/**
 * 볼 수 있는 주소를 만든다.
 *
 * 버킷이 비공개라 고정 주소가 없다. 짧게 사는 서명 주소를 그때그때 받는다 —
 * 주소가 새어 나가도 오래 쓰이지 않는다.
 */
export async function signedUrls(
  supabase: SupabaseClient,
  paths: string[],
  seconds = 3600,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, seconds);
  if (error || !data) return urls;

  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
