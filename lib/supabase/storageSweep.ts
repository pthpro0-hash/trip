import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET, markerPath, thumbPath } from "./photos";

/*
  사진 보관함 살펴보기와 치우기.

  사진 한 장은 파일 셋이다 — 보관본(2048px), 목록 판(960px), 핀 판(160px).
  이 셋 말고 보관함에 남은 것은 아무도 쓰지 않는 파일이다:

    - 지운 여행의 사진. 예전에는 여행을 지우면 기록만 지워지고 파일은
      남았다(지금은 함께 지운다).
    - 목록 판을 새 이름으로 다시 만들기 전의 낡은 판(.thumb.webp).
    - 올리다 중간에 끊긴 것.

  보관함은 사용자마다 폴더 하나(<사용자 id>/<방문 id>/<파일>)라 제 폴더만
  훑고 제 파일만 지운다. 보관함 정책도 그렇게 막고 있다.
*/

export interface StoredFile {
  path: string;
  bytes: number;
}

export type FileKind = "full" | "thumb" | "marker";

export interface StorageReport {
  /** 쓰이는 파일. 종류별 개수와 크기. */
  used: Record<FileKind, { count: number; bytes: number }>;
  /** 아무도 쓰지 않는 파일. */
  orphans: StoredFile[];
  orphanBytes: number;
  /** 기록에 있는 사진 수. */
  photoCount: number;
  /** 보관본이 무거운 사진. 경로는 보관본, 크기는 세 판을 더한 것. */
  heavy: StoredFile[];
  heavyBytes: number;
}

/*
  보관본이 이보다 크면 무겁다.

  보관본은 이제 600KB 상한 안에 굽는다(lib/photo/resize.ts 의 FULL_BUDGET).
  처음엔 아이폰 사파리가 PNG 로 굳힌 4MB 짜리만 잡으려고 1.5MB 로 두었는데,
  그것을 다시 줄인 것도 다른 브라우저의 JPEG 라 1MB 안팎이었다. 상한보다
  넉넉히 위를 기준으로 삼아, 상한 없이 구워진 것을 모두 잡는다.
*/
export const HEAVY_BYTES = 800 * 1024;

/** 다시 줄인 한 장(세 판)의 어림. WebP 로 굽는 브라우저 기준. */
export const RESHRUNK_BYTES = 0.5 * 1024 * 1024;

/*
  이만큼도 가벼워지지 않을 것이면 다시 줄이자고 권하지 않는다.

  숲이나 나뭇잎처럼 자잘한 사진은 가장 낮은 품질로 구워도 보관본이
  800KB 를 넘는다. 이런 사진 23장(25MB)이 남아, 살펴볼 때마다 "무겁게
  보관된 사진"이 떴다. 눌러도 거의 줄지 않는 일을 권하지 않는다.
*/
export const WORTH_RESHRINKING_BYTES = 50 * 1024 * 1024;

/** 무거운 사진을 다시 줄이면 가벼워질 어림. */
export function reshrinkSavings(report: Pick<StorageReport, "heavy" | "heavyBytes">): number {
  return Math.max(0, report.heavyBytes - report.heavy.length * RESHRUNK_BYTES);
}

/** 다시 줄이자고 권할 만한가. */
export function worthReshrinking(report: Pick<StorageReport, "heavy" | "heavyBytes">): boolean {
  return reshrinkSavings(report) >= WORTH_RESHRINKING_BYTES;
}

/** 보관함 파일을 기록과 맞춰 본다. 파일 목록만 보고 셈한다 — 시험하기 쉽게. */
export function classifyFiles(files: StoredFile[], photoPaths: string[]): StorageReport {
  const kindOf = new Map<string, FileKind>();
  for (const path of photoPaths) {
    kindOf.set(path, "full");
    kindOf.set(thumbPath(path), "thumb");
    kindOf.set(markerPath(path), "marker");
  }
  const used: StorageReport["used"] = {
    full: { count: 0, bytes: 0 },
    thumb: { count: 0, bytes: 0 },
    marker: { count: 0, bytes: 0 },
  };
  const ownerOf = new Map<string, string>();
  for (const path of photoPaths) {
    ownerOf.set(thumbPath(path), path);
    ownerOf.set(markerPath(path), path);
  }
  const orphans: StoredFile[] = [];
  const fullBytes = new Map<string, number>();
  const photoBytes = new Map<string, number>();
  for (const file of files) {
    const kind = kindOf.get(file.path);
    if (kind) {
      used[kind].count += 1;
      used[kind].bytes += file.bytes;
      const owner = kind === "full" ? file.path : ownerOf.get(file.path)!;
      photoBytes.set(owner, (photoBytes.get(owner) ?? 0) + file.bytes);
      if (kind === "full") fullBytes.set(file.path, file.bytes);
    } else {
      orphans.push(file);
    }
  }
  const heavy = [...fullBytes]
    .filter(([, bytes]) => bytes > HEAVY_BYTES)
    .map(([path]) => ({ path, bytes: photoBytes.get(path) ?? 0 }));
  return {
    used,
    orphans,
    orphanBytes: orphans.reduce((sum, file) => sum + file.bytes, 0),
    photoCount: photoPaths.length,
    heavy,
    heavyBytes: heavy.reduce((sum, file) => sum + file.bytes, 0),
  };
}

const PAGE = 1000;

/** 한 폴더의 항목을 모두. 폴더(파일 아닌 것)는 id 가 없다. */
async function listAll(supabase: SupabaseClient, prefix: string) {
  const entries: { name: string; id: string | null; metadata: Record<string, unknown> | null }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset });
    if (error || !data) throw new Error("list failed");
    entries.push(...(data as typeof entries));
    if (data.length < PAGE) return entries;
  }
}

/*
  기록에 있는 사진 경로를 빠짐없이.

  표는 한 번에 1,000줄까지만 돌려준다. 그대로 받으면 1,001번째부터의
  사진이 "기록에 없는 파일"로 잡혀 지워질 뻔했다 — 되돌릴 수 없는 일이다.
  1,000줄씩 나눠 받고, 받은 수가 표의 전체 수와 다르면 아예 멈춘다.
*/
async function allPhotoPaths(supabase: SupabaseClient, userId: string): Promise<string[] | null> {
  const { count, error: countError } = await supabase
    .from("trip_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError || count === null) return null;

  const paths: string[] = [];
  for (let from = 0; from < count; from += PAGE) {
    const { data, error } = await supabase
      .from("trip_photos")
      .select("storage_path")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    paths.push(...data.map((row) => String(row.storage_path)));
  }
  return paths.length === count ? paths : null;
}

/**
 * 내 보관함을 훑어 기록과 맞춰 본다. 못 훑었으면 null — 모르는 채로
 * 지우지 않는다.
 */
export async function scanStorage(
  supabase: SupabaseClient,
  userId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<StorageReport | null> {
  try {
    const photoPaths = await allPhotoPaths(supabase, userId);
    if (!photoPaths) return null;

    const folders = (await listAll(supabase, userId)).filter((entry) => entry.id === null);
    const files: StoredFile[] = [];
    for (const [index, folder] of folders.entries()) {
      const prefix = `${userId}/${folder.name}`;
      for (const entry of await listAll(supabase, prefix)) {
        if (entry.id === null) continue;
        files.push({ path: `${prefix}/${entry.name}`, bytes: Number(entry.metadata?.size ?? 0) });
      }
      onProgress?.(index + 1, folders.length);
    }
    return classifyFiles(files, photoPaths);
  } catch {
    return null;
  }
}

/** 아무도 쓰지 않는 파일을 지운다. 지운 수를 돌려준다. */
export async function sweepOrphans(
  supabase: SupabaseClient,
  userId: string,
  orphans: StoredFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  // 제 폴더 밖의 것은 목록에 있어도 건드리지 않는다.
  const mine = orphans.filter((file) => file.path.startsWith(`${userId}/`));
  let removed = 0;
  for (let start = 0; start < mine.length; start += 100) {
    const batch = mine.slice(start, start + 100).map((file) => file.path);
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
    if (!error) removed += data?.length ?? batch.length;
    onProgress?.(Math.min(start + 100, mine.length), mine.length);
  }
  return removed;
}
