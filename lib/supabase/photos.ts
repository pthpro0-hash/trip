import type { SupabaseClient } from "@supabase/supabase-js";
import { shrinkToWebp, UnsupportedImageError } from "@/lib/photo/resize";

export const BUCKET = "trip-photos";
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
  target: UploadTarget,
  blob: Blob,
): Promise<Slot> {
  // 맨 앞 칸이 사용자 id 라야 보관함 정책이 남의 폴더를 막아 준다.
  const path = `${userId}/${target.visitId}/${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/webp", upsert: false });

  if (uploadError) return { kind: "failed" };

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
export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  targets: UploadTarget[],
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
    let blob: Blob;
    try {
      blob = await shrinkToWebp(target.file);
    } catch (error) {
      finish(
        index,
        error instanceof UnsupportedImageError
          ? { kind: "unsupported", name: target.file.name }
          : { kind: "failed" },
      );
      continue;
    }

    quota.left -= 1;

    const fly = async () => {
      try {
        const slot = await putOne(supabase, userId, target, blob);
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
  const { error } = await supabase
    .from("trip_photos")
    .delete()
    .eq("id", photo.id)
    .eq("user_id", userId);

  if (error) return false;

  await supabase.storage.from(BUCKET).remove([photo.storagePath]);
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
