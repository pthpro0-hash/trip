import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";
import { thumbUrls } from "./photos";
import { isSnapshot, newShareId, type ShareScope, type ShareSnapshot } from "@/lib/share";

/*
  링크로 보여 주기 — 올리고, 고치고, 끊는다.

  표와 보관함의 규칙은 supabase/share.sql 에 있다. 여기서 지키는 순서:

    만들 때  줄을 먼저 적는다 → 사진을 올린다.
             보관함은 "그 링크의 주인"만 올리게 막아 두었는데, 주인인지는
             줄을 보고 안다. 줄이 없으면 올릴 수 없다.
    끊을 때  폴더를 먼저 비운다 → 줄을 지운다.
             줄부터 지우면 주인임을 밝힐 길이 없어져 사진이 영영 남는다 —
             주소를 아는 사람은 계속 볼 수 있다. 사진을 못 지웠으면 줄도
             남겨 두고 실패를 알린다. 다시 누르면 된다.

  사진 파일 이름에는 만든 때를 박는다. 공개 보관함의 파일은 한동안
  캐시되므로, 같은 이름에 다른 사진을 덮어쓰면 보는 사람에게 예전 사진이
  보일 수 있다.
*/

export const SHARE_BUCKET = "shared-sketches";
const TABLE = "sketch_shares";
/** 사진을 나란히 올리는 수. */
const LANES = 4;

export interface OwnShare {
  id: string;
  scope: ShareScope;
  updatedAt: string;
  /** 모양이 틀린 줄이면 null. 그래도 주소는 돌려준다 — 끊거나 고칠 수 있어야 한다. */
  snapshot: ShareSnapshot | null;
}

/**
 * 링크 보관함 파일의 공개 주소. 서버에서도 쓰므로 클라이언트 없이 만든다.
 *
 * 이름은 스냅샷에서 오고, 스냅샷은 만든 사람이 적은 것이다. "../" 같은
 * 것이 섞여도 그 링크 폴더 밖을 가리키지 못하게 한 칸으로 묶는다.
 */
export function publicFileUrl(shareId: string, file: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${SHARE_BUCKET}/${encodeURIComponent(shareId)}/${encodeURIComponent(file)}`;
}

/** 그해에 만들어 둔 링크. 없으면 null, 묻지 못했으면 "failed". */
export async function fetchOwnShare(
  supabase: SupabaseClient,
  userId: string,
  year: number,
): Promise<OwnShare | null | "failed"> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id,scope,updated_at,snapshot")
    .eq("user_id", userId)
    .eq("year", year)
    .maybeSingle();

  if (error) return "failed";
  if (!data) return null;
  return {
    id: String(data.id),
    scope: data.scope as ShareScope,
    updatedAt: String(data.updated_at),
    snapshot: isSnapshot(data.snapshot) ? data.snapshot : null,
  };
}

export interface PublishInput {
  userId: string;
  year: number;
  scope: ShareScope;
  /** 이미 있는 링크. 있으면 같은 링크의 내용만 바꾼다. */
  existing: OwnShare | null;
  /** 올릴 사진의 원본 보관 경로. 사진까지가 아니면 비어 있다. */
  photoPaths: string[];
  /** 링크 미리보기 그림. 못 만들었으면 null. */
  cover: Blob | null;
  /** 파일 이름이 정해지면 스냅샷을 짓는다. */
  build: (files: Map<string, string>, cover: string | null) => ShareSnapshot;
  /** 사진을 한 장 올릴 때마다. 기다리는 화면에 몇 장째인지 보인다. */
  onProgress?: (done: number, total: number) => void;
}

export interface Published {
  id: string;
  /**
   * 예전 판의 파일을 다 치웠는가. 못 치웠으면 링크는 새 모습이지만, 예전
   * 사진이 주소를 아는 사람에게 아직 보일 수 있다 — 다시 누르게 알린다.
   */
  clean: boolean;
}

/** 링크 폴더에 있는 파일 이름들. 주인만 볼 수 있다. 못 보면 null. */
async function listFolder(supabase: SupabaseClient, id: string): Promise<string[] | null> {
  const { data, error } = await supabase.storage.from(SHARE_BUCKET).list(id, { limit: 1000 });
  if (error || !data) return null;
  return data.map((entry) => entry.name).filter((name) => name && !name.startsWith("."));
}

/** 폴더에서 keep 에 없는 것을 모두 지운다. 다 지웠으면 true. */
async function sweepFolder(supabase: SupabaseClient, id: string, keep: Set<string>): Promise<boolean> {
  const names = await listFolder(supabase, id);
  if (names === null) return false;
  const stale = names.filter((name) => !keep.has(name));
  if (stale.length === 0) return true;
  const { error } = await supabase.storage.from(SHARE_BUCKET).remove(stale.map((name) => `${id}/${name}`));
  return !error;
}

/**
 * 링크를 만들거나 지금 모습으로 고친다.
 *
 * 링크 주소는 한 번 정해지면 바뀌지 않는다(share.sql 의 트리거가 막는다).
 * 그래서 upsert 를 쓰지 않는다 — 같은 해의 줄이 이미 있을 때 upsert 는
 * 주소까지 새것으로 덮으려 한다. 없으면 넣고, 있으면 그 주소로 고친다.
 * 다른 기기에서 먼저 만들어 두었으면(넣기가 겹침으로 막히면) 그 줄을
 * 찾아 고친다.
 */
export async function publishShare(supabase: SupabaseClient, input: PublishInput): Promise<Published | null> {
  const stamp = Date.now().toString(36);
  const files = new Map(input.photoPaths.map((path, index) => [path, `${stamp}-${index}.webp`]));
  const cover = input.cover ? `${stamp}-card.png` : null;

  const update = async (id: string, snapshot: ShareSnapshot) => {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ scope: input.scope, snapshot, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    // 다른 곳에서 끊었으면 고칠 줄이 없다.
    return !error && Array.isArray(data) && data.length === 1;
  };

  // 줄이 먼저다 — 보관함은 줄을 보고 주인을 가린다.
  let id: string;
  const first = input.build(files, cover);
  if (input.existing) {
    id = input.existing.id;
    if (!(await update(id, first))) return null;
  } else {
    id = newShareId();
    const { error } = await supabase
      .from(TABLE)
      .insert({ id, user_id: input.userId, year: input.year, scope: input.scope, snapshot: first });
    if (error) {
      // 23505: 같은 해의 줄이 이미 있다(다른 기기). 그 주소로 고친다.
      if (error.code !== "23505") return null;
      const found = await fetchOwnShare(supabase, input.userId, input.year);
      if (!found || found === "failed") return null;
      id = found.id;
      if (!(await update(id, first))) return null;
    }
  }

  /*
    공개 보관함은 CDN 이 캐시한다. 길게 두면 링크를 끊은 뒤에도 한동안
    사진이 보인다. 1분이면 받는 쪽 속도에는 거의 차이가 없다.
  */
  const put = (file: string, body: Blob, contentType: string) =>
    supabase.storage
      .from(SHARE_BUCKET)
      .upload(`${id}/${file}`, body, { contentType, upsert: true, cacheControl: "60" });

  // 비공개 보관함의 목록 판(960px)을 받아 그대로 옮긴다.
  const failed = new Set<string>();
  const urls = input.photoPaths.length > 0 ? await thumbUrls(supabase, input.photoPaths) : new Map<string, string>();
  const queue = [...files.entries()];
  let done = 0;
  const lane = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [path, file] = next;
      try {
        const url = urls.get(path);
        const response = url ? await fetch(url) : null;
        if (!response?.ok) throw new Error("download failed");
        const blob = await response.blob();
        // 보관함은 그림만 받는다. 형식을 못 밝힌 것은 webp 로 적는다(목록 판은 webp 다).
        const { error } = await put(file, blob, blob.type.startsWith("image/") ? blob.type : "image/webp");
        if (error) throw error;
      } catch {
        failed.add(path);
      }
      done += 1;
      input.onProgress?.(done, files.size);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LANES, queue.length) }, lane));

  let coverOk = false;
  if (input.cover && cover) {
    const { error } = await put(cover, input.cover, "image/png");
    coverOk = !error;
  }

  // 못 올린 것은 스냅샷에서 뺀다. 빈 자리를 가리키는 링크를 남기지 않는다.
  if (failed.size > 0 || (cover && !coverOk)) {
    for (const path of failed) files.delete(path);
    if (!(await update(id, input.build(files, coverOk ? cover : null)))) return null;
  }

  /*
    예전 판의 파일은 치운다. 스냅샷에 적힌 것만 지우면, 다른 기기에서
    올렸거나 중간에 끊긴 판의 파일이 공개로 남는다. 폴더를 통째로 보고
    지금 판이 쓰는 것 말고는 다 지운다.
  */
  const keep = new Set([...files.values(), ...(coverOk && cover ? [cover] : [])]);
  const clean = await sweepFolder(supabase, id, keep);
  return { id, clean };
}

/**
 * 링크를 끊는다. 폴더를 먼저 비우고, 줄은 나중에.
 *
 * 폴더를 못 봤거나 다 못 지웠으면 줄을 남기고 실패를 알린다. 줄이
 * 없으면 주인임을 밝힐 길이 없어 남은 사진을 영영 못 지운다.
 */
export async function revokeShare(supabase: SupabaseClient, share: OwnShare): Promise<boolean> {
  if (!(await sweepFolder(supabase, share.id, new Set()))) return false;
  // 다른 곳에서 먼저 끊었어도(지울 줄이 없어도) 끊긴 것이다.
  const { error } = await supabase.from(TABLE).delete().eq("id", share.id);
  return !error;
}

export interface SharedSketch {
  id: string;
  snapshot: ShareSnapshot;
  updatedAt: string;
}

/**
 * 남이 여는 링크. 표는 닫혀 있고, id 하나를 받아 그 한 줄만 돌려주는
 * 함수만 열려 있다(share.sql 의 shared_sketch).
 */
export async function fetchSharedSketch(supabase: SupabaseClient, id: string): Promise<SharedSketch | null> {
  const { data, error } = await supabase.rpc("shared_sketch", { share_id: id });
  if (error || !data || typeof data !== "object") return null;
  const row = data as { id?: unknown; snapshot?: unknown; updatedAt?: unknown };
  if (!isSnapshot(row.snapshot)) return null;
  return { id: String(row.id), snapshot: row.snapshot, updatedAt: String(row.updatedAt ?? "") };
}
