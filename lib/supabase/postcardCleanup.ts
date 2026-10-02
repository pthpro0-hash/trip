import type { SupabaseClient } from "@supabase/supabase-js";

/*
  엽서 사진 복사본을 치우는 일.

  여행이나 사진을 지우는 코드(trips.ts·photos.ts)가 부르는 쪽이라, 사진을 올리는 postcards.ts 를
  끌어오지 않게 따로 둔다. 순서는 늘 같다 — 파일을 먼저 지우고 줄은 나중에. 줄이 먼저 사라지면
  폴더의 주인을 밝힐 길이 없어 사진이 공개 보관함에 영영 남는다. 파일을 못 지웠으면 false 를 돌려주고,
  부르는 쪽은 줄도, 원본도 지우지 않는다.
*/

export const POSTCARD_BUCKET = "postcards";

/** 표가 아직 없을 때(mailbox.sql 을 실행하기 전)의 오류 코드. 이때는 엽서가 없는 것으로 본다. */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

/** 엽서 사진 폴더의 파일을 모두 지운다. 지운 수가 맞는지까지 본다 — 권한이 없으면 오류 없이 못 지운다. */
export async function sweepPostcardFolder(supabase: SupabaseClient, postcardId: string): Promise<boolean> {
  const storage = supabase.storage.from(POSTCARD_BUCKET);
  const { data, error } = await storage.list(postcardId, { limit: 1000 });
  if (error || !data) return false;
  const names = data.map((entry) => entry.name).filter((name) => name && !name.startsWith("."));
  if (names.length === 0) return true;
  const removed = await storage.remove(names.map((name) => `${postcardId}/${name}`));
  return !removed.error && (removed.data?.length ?? 0) === names.length;
}

/** 엽서를 거둔다 — 모든 우편함에서 사라진다. 파일을 못 지웠으면 줄도 남긴다. */
export async function withdrawPostcard(supabase: SupabaseClient, postcardId: string): Promise<boolean> {
  if (!(await sweepPostcardFolder(supabase, postcardId))) return false;
  const { error } = await supabase.from("postcards").delete().eq("id", postcardId);
  return !error;
}

/**
 * 여행을 지우기 전에 그 여행으로 보낸 엽서의 사진을 모두 치운다. 엽서 줄은 여행 줄과 함께 지워진다
 * (on delete cascade). 하나라도 못 치웠거나 엽서가 있는지 확인하지 못했으면 false — 여행도 지우지 않는다.
 */
export async function removeCopiesOfTrip(supabase: SupabaseClient, tripId: string): Promise<boolean> {
  const { data, error } = await supabase.from("postcards").select("id").eq("trip_id", tripId);
  if (error) return MISSING_TABLE.has(error.code ?? "");
  for (const postcard of (data ?? []) as { id: string }[]) {
    if (!(await sweepPostcardFolder(supabase, postcard.id))) return false;
  }
  return true;
}

/**
 * 사진 한 장을 지우기 전에, 그 사진에서 나온 엽서 복사본을 치운다. 파일을 먼저, 기록은 나중에.
 * 못 치웠으면 false — 원본도 지우지 않는다.
 */
export async function removeCopiesOfPhoto(supabase: SupabaseClient, photoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("postcard_photos")
    .select("postcard_id,file")
    .eq("source_photo_id", photoId);
  if (error) return MISSING_TABLE.has(error.code ?? "");
  const rows = (data ?? []) as { postcard_id: string; file: string }[];
  if (rows.length === 0) return true;

  const paths = rows.map((row) => `${row.postcard_id}/${row.file}`);
  const removed = await supabase.storage.from(POSTCARD_BUCKET).remove(paths);
  if (removed.error || (removed.data?.length ?? 0) !== paths.length) return false;

  const { error: deleteError } = await supabase.from("postcard_photos").delete().eq("source_photo_id", photoId);
  return !deleteError;
}

