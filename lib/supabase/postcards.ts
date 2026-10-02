import type { SupabaseClient } from "@supabase/supabase-js";
import { POSTCARD_PHOTOS, buildPostcardSnapshot, newPostcardId } from "@/lib/mailbox";
import { thumbUrls } from "./photos";
import { POSTCARD_BUCKET, sweepPostcardFolder } from "./postcardCleanup";
import type { TripDetail } from "./tripDetail";

/*
  엽서 — 보내고, 거두고, 원본이 지워질 때 복사본을 치운다.

  표와 규칙은 supabase/mailbox.sql 에 있다. 순서가 전부다(링크 공유와 같은 원칙):

    보낼 때  엽서 줄을 먼저 넣는다 → 사진을 올린다.
             보관함은 "그 엽서를 보낸 사람"만 올리게 막아 두었는데, 보낸 사람인지는 줄을 보고 안다.
             중간에 하나라도 실패하면 올린 것을 치우고 줄도 지운다 — 엽서는 보낸 순간 그대로 남아야 해서
             절반만 간 엽서를 두지 않는다(엽서 줄은 고칠 수 없다).
    지울 때  파일을 먼저 지운다 → 줄은 나중에.
             줄이 먼저 사라지면 폴더의 주인을 밝힐 길이 없어 사진이 공개 보관함에 영영 남는다.
             파일을 못 지웠으면 줄도, 원본도 지우지 않고 실패를 알린다. 다시 누르면 된다.

  사진은 엽서당 한 번만 복사한다(우편함이 몇 개든). 보관함은 공개라 CDN 이 캐시하므로 캐시를
  짧게(1분) 둔다 — 길게 두면 지운 뒤에도 한동안 사진이 보인다.
*/

/** 사진을 나란히 올리는 수. */
const LANES = 3;

// 지우는 쪽은 postcardCleanup 에 있다(여행·사진을 지우는 코드가 사진 올리는 코드를 끌어오지 않게).
export { POSTCARD_BUCKET, removeCopiesOfPhoto, removeCopiesOfTrip, sweepPostcardFolder, withdrawPostcard } from "./postcardCleanup";

export interface SendPostcardInput {
  senderId: string;
  /** 받는 쪽에 보이는 보낸 사람의 이름("지민"). */
  senderName: string;
  trip: TripDetail;
  /** 엽서에 실을 사진(trip_photos id). */
  photoIds: string[];
  /** 받을 우편함과 그 우편함에 보일 인사말(호칭 포함). */
  deliveries: { mailboxId: string; greeting: string }[];
  onProgress?: (done: number, total: number) => void;
}

export type SendPostcardResult =
  | { ok: true; postcardId: string }
  | { ok: false; reason: "invalid" | "photos" | "failed" };

/** 엽서를 보낸다. 우편함마다 다른 인사말이 들어가고, 사진은 한 번만 복사한다. */
export async function sendPostcard(supabase: SupabaseClient, input: SendPostcardInput): Promise<SendPostcardResult> {
  const { senderId, trip, deliveries, onProgress } = input;
  const senderName = input.senderName.trim();
  if (deliveries.length === 0 || senderName.length < 1 || senderName.length > 20) {
    return { ok: false, reason: "invalid" };
  }
  if (input.photoIds.length > POSTCARD_PHOTOS || new Set(input.photoIds).size !== input.photoIds.length) {
    return { ok: false, reason: "invalid" };
  }

  const wanted = new Set(input.photoIds);
  const chosen = trip.visits.flatMap((visit) => visit.photos).filter((photo) => wanted.has(photo.id));
  if (chosen.length !== wanted.size) return { ok: false, reason: "invalid" };

  const postcardId = newPostcardId();
  const stamp = Date.now().toString(36);
  const files = new Map(chosen.map((photo, index) => [photo.storagePath, `${stamp}-${index}.webp`]));

  /** 되돌린다. 파일을 먼저 치우고 줄은 나중에(줄이 먼저 사라지면 파일의 주인을 밝힐 길이 없다). */
  const undo = async () => {
    await sweepPostcardFolder(supabase, postcardId);
    await supabase.from("postcards").delete().eq("id", postcardId);
  };

  // 줄이 먼저다 — 보관함은 줄을 보고 주인을 가린다.
  const row = await supabase.from("postcards").insert({
    id: postcardId,
    sender_id: senderId,
    trip_id: trip.id,
    sender_name: senderName,
    snapshot: buildPostcardSnapshot(trip, files),
  });
  if (row.error) return { ok: false, reason: "failed" };

  // 원본 사진을 지우면 복사본을 찾아 지울 수 있게, 어느 사진에서 나왔는지 적어 둔다.
  if (chosen.length > 0) {
    const records = await supabase.from("postcard_photos").insert(
      chosen.map((photo, index) => ({
        postcard_id: postcardId,
        file: files.get(photo.storagePath)!,
        source_photo_id: photo.id,
        position: index,
      })),
    );
    if (records.error) {
      await undo();
      return { ok: false, reason: "failed" };
    }
  }

  // 비공개 보관함의 목록 판(960px)을 받아 엽서 보관함으로 한 번만 옮긴다.
  if (chosen.length > 0) {
    const urls = await thumbUrls(supabase, chosen.map((photo) => photo.storagePath));
    const queue = [...files.entries()];
    let done = 0;
    let failed = false;
    const lane = async () => {
      for (let next = queue.shift(); next && !failed; next = queue.shift()) {
        const [path, file] = next;
        try {
          const url = urls.get(path);
          const response = url ? await fetch(url) : null;
          if (!response?.ok) throw new Error("download failed");
          const body = await response.blob();
          const { error } = await supabase.storage.from(POSTCARD_BUCKET).upload(`${postcardId}/${file}`, body, {
            contentType: body.type.startsWith("image/") ? body.type : "image/webp",
            upsert: false,
            cacheControl: "60",
          });
          if (error) throw error;
        } catch {
          failed = true;
        }
        done += 1;
        onProgress?.(done, files.size);
      }
    };
    await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, lane));
    if (failed) {
      await undo();
      return { ok: false, reason: "photos" };
    }
  }

  // 우편함에 넣는다. 우편함마다 인사말이 다르다.
  const delivered = await supabase.from("postcard_deliveries").insert(
    deliveries.map((delivery) => ({
      postcard_id: postcardId,
      mailbox_id: delivery.mailboxId,
      greeting: delivery.greeting,
    })),
  );
  if (delivered.error) {
    await undo();
    return { ok: false, reason: "failed" };
  }
  return { ok: true, postcardId };
}

/** 여행마다 보낸 엽서 수. 지우기 확인 창에 보여 준다. 못 읽으면 빈 표(확인 창이 숫자를 못 보여 줄 뿐이다). */
export async function fetchPostcardCounts(supabase: SupabaseClient, userId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const { data, error } = await supabase.from("postcards").select("trip_id").eq("sender_id", userId);
  if (error || !data) return counts;
  for (const row of data as { trip_id: string }[]) counts.set(row.trip_id, (counts.get(row.trip_id) ?? 0) + 1);
  return counts;
}

export interface SentPostcard {
  id: string;
  tripId: string;
  title: string | null;
  startedOn: string;
  sentAt: string;
  /** 어느 우편함에 넣었고, 받는 분이 열어 봤는가. */
  deliveries: { mailboxId: string; opened: boolean }[];
}

/** 내가 보낸 엽서들(최근 것부터). 못 읽으면 빈 목록. */
export async function fetchSentPostcards(supabase: SupabaseClient, userId: string): Promise<SentPostcard[]> {
  const [cards, deliveries] = await Promise.all([
    supabase
      .from("postcards")
      .select("id,trip_id,created_at,snapshot")
      .eq("sender_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("postcard_deliveries").select("postcard_id,mailbox_id,opened_at"),
  ]);
  if (cards.error || !cards.data) return [];
  const byCard = new Map<string, SentPostcard["deliveries"]>();
  for (const row of (deliveries.data ?? []) as { postcard_id: string; mailbox_id: string; opened_at: string | null }[]) {
    byCard.set(row.postcard_id, [...(byCard.get(row.postcard_id) ?? []), { mailboxId: row.mailbox_id, opened: row.opened_at != null }]);
  }
  return (cards.data as { id: string; trip_id: string; created_at: string; snapshot: { title?: string | null; startedOn?: string } }[]).map((row) => ({
    id: row.id,
    tripId: row.trip_id,
    title: row.snapshot?.title ?? null,
    startedOn: row.snapshot?.startedOn ?? "",
    sentAt: row.created_at,
    deliveries: byCard.get(row.id) ?? [],
  }));
}

/** 이 사진들 가운데 엽서에 쓰인 것. 사진 지우기 확인 창에 보여 준다. */
export async function fetchPhotosInPostcards(supabase: SupabaseClient, photoIds: string[]): Promise<Set<string>> {
  if (photoIds.length === 0) return new Set();
  const { data, error } = await supabase.from("postcard_photos").select("source_photo_id").in("source_photo_id", photoIds);
  if (error || !data) return new Set();
  return new Set((data as { source_photo_id: string }[]).map((row) => row.source_photo_id));
}
