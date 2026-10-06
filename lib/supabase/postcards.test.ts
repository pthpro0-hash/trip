// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripDetail } from "./tripDetail";

const shrink = vi.hoisted(() => ({ postcardFromBlob: vi.fn(async (blob: Blob) => new Blob(["small"], { type: blob.type })) }));
vi.mock("@/lib/photo/resize", () => ({ postcardFromBlob: shrink.postcardFromBlob }));
vi.mock("./photos", () => ({
  thumbUrls: vi.fn(async (_supabase: unknown, paths: string[]) => new Map(paths.map((path) => [path, `https://signed/${path}`]))),
}));

const {
  POSTCARD_BUCKET,
  fetchPhotosInPostcards,
  fetchPostcardCounts,
  fetchSentPostcards,
  fetchUnreadReplyCount,
  markRepliesSeen,
  removeCopiesOfPhoto,
  removeCopiesOfTrip,
  sendPostcard,
  sweepPostcardFolder,
  withdrawPostcard,
} = await import("./postcards");

/*
  엽서를 보낼 때는 줄이 먼저(보관함이 줄을 보고 주인을 가린다), 지울 때는 파일이 먼저(줄이 없으면
  사진을 지울 길이 없어 공개 보관함에 영영 남는다). 파일을 못 지웠으면 줄도, 원본도 지우지 않는다.
*/

const trip: TripDetail = {
  id: "t1",
  title: "강릉 바다",
  subtitle: null,
  startedOn: "2026-09-13",
  endedOn: "2026-09-13",
  companions: "민수",
  note: "비가 왔다",
  visits: [
    {
      id: "v1",
      placeName: "안목해변",
      spotId: null,
      dong: null,
      lat: 37.77281,
      lng: 128.94742,
      startedAt: new Date("2026-09-13T09:00:00"),
      endedAt: new Date("2026-09-13T10:00:00"),
      photos: [
        { id: "p1", storagePath: "u/v1/a.webp", takenAt: new Date("2026-09-13T09:00:00"), isCover: true },
        { id: "p2", storagePath: "u/v1/b.webp", takenAt: new Date("2026-09-13T09:30:00"), isCover: false },
        { id: "p3", storagePath: "u/v1/c.webp", takenAt: new Date("2026-09-13T09:40:00"), isCover: false },
      ],
    },
  ],
};

interface Options {
  failInsert?: string;
  failUpload?: boolean;
  failRemove?: boolean;
  /** 지울 권한이 없을 때처럼 오류 없이 하나도 못 지운다. */
  silentRemove?: boolean;
  selectError?: string;
  postcardsOfTrip?: { id: string }[];
  photoRows?: { postcard_id: string; file: string }[];
  countRows?: { trip_id: string }[];
  inPostcards?: { source_photo_id: string }[];
  sentRows?: unknown[];
  deliveryRows?: unknown[];
  replyRows?: unknown[];
  unread?: number;
  failUpdate?: boolean;
}

function fake(options: Options = {}) {
  const log: string[] = [];
  const inserted: Record<string, unknown[]> = {};
  const uploaded: { path: string; options: { cacheControl?: string; upsert?: boolean } }[] = [];
  const folder: string[] = [];
  const updated: { table: string; ids: string[]; patch: { seen_at?: string } }[] = [];

  const rowsFor = (name: string, columns: string) => {
    if (name === "postcards" && columns.includes("snapshot")) return options.sentRows ?? [];
    if (name === "postcard_deliveries") return options.deliveryRows ?? [];
    if (name === "postcard_replies") return options.replyRows ?? [];
    if (name === "postcards" && columns === "id") return options.postcardsOfTrip ?? [];
    if (name === "postcards") return options.countRows ?? [];
    if (name === "postcard_photos" && columns.includes("postcard_id")) return options.photoRows ?? [];
    if (name === "postcard_photos") return options.inPostcards ?? [];
    return [];
  };

  const from = (name: string) => ({
    insert: async (row: unknown) => {
      log.push(`insert ${name}`);
      if (options.failInsert === name) return { error: { message: "nope" } };
      (inserted[name] ??= []).push(...(Array.isArray(row) ? row : [row]));
      return { error: null };
    },
    select: (columns: string, opts?: { head?: boolean }) => {
      log.push(`select ${name}${opts?.head ? " head" : ""}`);
      const result = options.selectError
        ? { data: null, count: null, error: { code: options.selectError, message: "x" } }
        : { data: rowsFor(name, columns), count: options.unread ?? 0, error: null };
      const chain: Record<string, unknown> = {
        eq: () => chain,
        in: () => chain,
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        then: (resolve: (v: typeof result) => void) => resolve(result),
      };
      return chain;
    },
    update: (patch: { seen_at?: string }) => ({
      in: async (column: string, ids: string[]) => {
        log.push(`update ${name} ${column} in ${ids.length}`);
        if (options.failUpdate) return { error: { message: "nope" } };
        updated.push({ table: name, ids, patch });
        return { error: null };
      },
    }),
    delete: () => ({
      eq: async (column: string, value: string) => {
        log.push(`delete ${name} ${column}=${value}`);
        return { error: null };
      },
      in: async (column: string) => {
        log.push(`delete ${name} ${column} in`);
        return { error: null };
      },
    }),
  });

  const storage = {
    from: (bucket: string) => {
      expect(bucket).toBe(POSTCARD_BUCKET);
      return {
        list: async () => ({ data: folder.map((name) => ({ name })), error: null }),
        upload: async (path: string, _body: unknown, opts: { cacheControl?: string; upsert?: boolean }) => {
          log.push(`upload ${path}`);
          if (options.failUpload) return { error: { message: "nope" } };
          uploaded.push({ path, options: opts });
          folder.push(path.split("/").pop()!);
          return { error: null };
        },
        remove: async (paths: string[]) => {
          log.push(`remove ${paths.length}`);
          if (options.failRemove) return { data: null, error: { message: "nope" } };
          if (options.silentRemove) return { data: [], error: null };
          return { data: paths.map((name) => ({ name })), error: null };
        },
      };
    },
  };
  const supabase = { from, storage } as unknown as SupabaseClient;
  return { supabase, log, inserted, uploaded, folder, updated };
}

beforeEach(() => {
  shrink.postcardFromBlob.mockClear();
  shrink.postcardFromBlob.mockImplementation(async (blob: Blob) => new Blob(["small"], { type: blob.type }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["x"], { type: "image/webp" }))));
});
afterEach(() => vi.unstubAllGlobals());

const input = {
  senderId: "u",
  senderName: "지민",
  trip,
  photoIds: ["p1", "p2"],
  deliveries: [
    { mailboxId: "m1", greeting: "엄마 아빠, 바다 보고 왔어요" },
    { mailboxId: "m2", greeting: "장모님, 바다 보고 왔어요" },
  ],
};

describe("sendPostcard · 보내는 순서", () => {
  it("엽서 줄 → 복사본 기록 → 사진 올리기 → 우편함에 넣기 순서로, 사진은 한 번만 복사한다", async () => {
    const f = fake();
    const result = await sendPostcard(f.supabase, input);
    expect(result.ok).toBe(true);
    const order = f.log.filter((entry) => !entry.startsWith("select"));
    expect(order[0]).toBe("insert postcards");
    expect(order[1]).toBe("insert postcard_photos");
    expect(order.slice(2, 4).every((entry) => entry.startsWith("upload "))).toBe(true);
    expect(order[4]).toBe("insert postcard_deliveries");
    // 우편함이 둘이어도 사진은 두 장만 — 우편함마다 복사하지 않는다.
    expect(f.uploaded).toHaveLength(2);
  });

  it("엽서 줄에는 보낸 순간의 스냅샷이 들어가고, 메모·동행자는 없다", async () => {
    const f = fake();
    await sendPostcard(f.supabase, input);
    const row = f.inserted.postcards[0] as { id: string; sender_id: string; trip_id: string; sender_name: string; snapshot: { title: string; files: string[] } };
    expect(row).toMatchObject({ sender_id: "u", trip_id: "t1", sender_name: "지민" });
    expect(row.snapshot.title).toBe("강릉 바다");
    expect(row.snapshot.files).toHaveLength(2);
    const text = JSON.stringify(row);
    expect(text).not.toContain("비가 왔다");
    expect(text).not.toContain("민수");
  });

  it("사진은 엽서 주소 폴더에, 오래 캐시되지 않게(지우면 곧 안 보이게) 올린다", async () => {
    const f = fake();
    await sendPostcard(f.supabase, input);
    const id = (f.inserted.postcards[0] as { id: string }).id;
    for (const upload of f.uploaded) {
      expect(upload.path.startsWith(`${id}/`)).toBe(true);
      expect(upload.options.cacheControl).toBe("60");
    }
  });

  it("복사본 기록에는 원본 사진 id 가 적힌다 — 원본을 지우면 복사본을 찾아 지우는 데 쓴다", async () => {
    const f = fake();
    await sendPostcard(f.supabase, input);
    const rows = f.inserted.postcard_photos as { source_photo_id: string; file: string }[];
    expect(rows.map((row) => row.source_photo_id)).toEqual(["p1", "p2"]);
    expect(rows.map((row) => row.file)).toEqual(
      (f.inserted.postcards[0] as { snapshot: { files: string[] } }).snapshot.files,
    );
  });

  it("우편함마다 인사말이 따로 들어간다", async () => {
    const f = fake();
    await sendPostcard(f.supabase, input);
    expect(f.inserted.postcard_deliveries).toEqual([
      expect.objectContaining({ mailbox_id: "m1", greeting: "엄마 아빠, 바다 보고 왔어요" }),
      expect.objectContaining({ mailbox_id: "m2", greeting: "장모님, 바다 보고 왔어요" }),
    ]);
  });

  it("사진이 없는 엽서는 올리기·복사본 기록 없이 글과 지도만", async () => {
    const f = fake();
    const result = await sendPostcard(f.supabase, { ...input, photoIds: [] });
    expect(result.ok).toBe(true);
    expect(f.uploaded).toHaveLength(0);
    expect(f.inserted.postcard_photos).toBeUndefined();
  });
});

describe("sendPostcard · 실패하면 깨끗이 되돌린다", () => {
  it("사진을 올리지 못하면 올린 것을 치우고 엽서 줄도 지운다 — 우편함에는 넣지 않는다", async () => {
    const f = fake({ failUpload: true });
    const result = await sendPostcard(f.supabase, input);
    expect(result).toEqual({ ok: false, reason: "photos" });
    expect(f.log.some((entry) => entry.startsWith("delete postcards id="))).toBe(true);
    expect(f.inserted.postcard_deliveries).toBeUndefined();
  });

  it("우편함에 넣다 실패해도 사진과 엽서 줄을 치운다", async () => {
    const f = fake({ failInsert: "postcard_deliveries" });
    const result = await sendPostcard(f.supabase, input);
    expect(result).toEqual({ ok: false, reason: "failed" });
    const removeAt = f.log.findIndex((entry) => entry.startsWith("remove "));
    const deleteAt = f.log.findIndex((entry) => entry.startsWith("delete postcards id="));
    expect(removeAt).toBeGreaterThan(-1);
    // 파일이 먼저, 줄은 나중.
    expect(deleteAt).toBeGreaterThan(removeAt);
  });

  it("엽서 줄을 못 넣으면 아무것도 올리지 않는다", async () => {
    const f = fake({ failInsert: "postcards" });
    expect(await sendPostcard(f.supabase, input)).toEqual({ ok: false, reason: "failed" });
    expect(f.uploaded).toHaveLength(0);
  });

  it("받을 우편함이 없거나, 이름이 비었거나, 같은 사진을 두 번 골랐으면 묻지도 않는다", async () => {
    const f = fake();
    expect(await sendPostcard(f.supabase, { ...input, deliveries: [] })).toEqual({ ok: false, reason: "invalid" });
    expect(await sendPostcard(f.supabase, { ...input, senderName: "  " })).toEqual({ ok: false, reason: "invalid" });
    expect(await sendPostcard(f.supabase, { ...input, photoIds: ["p1", "p2", "p3", "p1"] })).toEqual({ ok: false, reason: "invalid" });
    expect(f.log).toHaveLength(0);
  });

  it("책장이 정한 한도(maxPhotos)를 넘으면 묻지도 않는다 — 한도 안에서는 20장까지 된다", async () => {
    const f = fake();
    expect(await sendPostcard(f.supabase, { ...input, maxPhotos: 2, photoIds: ["p1", "p2", "p3"] })).toEqual({ ok: false, reason: "invalid" });
    expect(f.log).toHaveLength(0);
    const ok = await sendPostcard(fake().supabase, { ...input, maxPhotos: 3, photoIds: ["p1", "p2", "p3"] });
    expect(ok.ok).toBe(true);
  });

  it("한도를 안 주면 20장까지 — 21장은 거절", async () => {
    const photos = Array.from({ length: 21 }, (_, i) => ({ id: `x${i}`, storagePath: `u/x${i}.webp`, takenAt: new Date("2026-09-13T09:00:00"), isCover: false }));
    const big = { ...trip, visits: [{ ...trip.visits[0], photos }] };
    const f = fake();
    expect(await sendPostcard(f.supabase, { ...input, trip: big, photoIds: photos.map((p) => p.id) })).toEqual({ ok: false, reason: "invalid" });
    expect(f.log).toHaveLength(0);
    const twenty = await sendPostcard(fake().supabase, { ...input, trip: big, photoIds: photos.slice(0, 20).map((p) => p.id) });
    expect(twenty.ok).toBe(true);
  });
});

describe("sendPostcard · 사진 크기", () => {
  it("보통(640px)이면 목록 판(960px)을 받아 줄여서 올린다 — 책 한 권이 가벼워진다", async () => {
    const f = fake();
    await sendPostcard(f.supabase, { ...input, size: 640 });
    expect(shrink.postcardFromBlob).toHaveBeenCalledTimes(2);
    expect(f.uploaded).toHaveLength(2);
  });

  it("크기를 안 주면 보통(640px)", async () => {
    await sendPostcard(fake().supabase, input);
    expect(shrink.postcardFromBlob).toHaveBeenCalledTimes(2);
  });

  it("선명(960px)이면 목록 판을 그대로 올린다", async () => {
    const f = fake();
    await sendPostcard(f.supabase, { ...input, size: 960 });
    expect(shrink.postcardFromBlob).not.toHaveBeenCalled();
    expect(f.uploaded).toHaveLength(2);
  });

  it("줄이다 실패하면 올리다 실패한 것과 같다 — 올린 것을 치우고 엽서 줄도 지운다", async () => {
    shrink.postcardFromBlob.mockRejectedValue(new Error("canvas"));
    const f = fake();
    const result = await sendPostcard(f.supabase, input);
    expect(result).toEqual({ ok: false, reason: "photos" });
    expect(f.log.some((entry) => entry.startsWith("delete postcards id="))).toBe(true);
    expect(f.inserted.postcard_deliveries).toBeUndefined();
  });
});

describe("sweepPostcardFolder", () => {
  it("폴더의 파일을 모두 지우고, 지운 수가 맞는지 본다", async () => {
    const f = fake();
    f.folder.push("a.webp", "b.webp", ".emptyFolderPlaceholder");
    expect(await sweepPostcardFolder(f.supabase, "pid")).toBe(true);
    expect(f.log).toEqual(["remove 2"]);
  });

  it("지울 권한이 없어 오류 없이 하나도 못 지웠으면 실패로 본다(가족 계정 등)", async () => {
    const f = fake({ silentRemove: true });
    f.folder.push("a.webp");
    expect(await sweepPostcardFolder(f.supabase, "pid")).toBe(false);
  });

  it("오류가 나면 실패", async () => {
    const f = fake({ failRemove: true });
    f.folder.push("a.webp");
    expect(await sweepPostcardFolder(f.supabase, "pid")).toBe(false);
  });

  it("비어 있으면 지울 것도 없다", async () => {
    expect(await sweepPostcardFolder(fake().supabase, "pid")).toBe(true);
  });
});

describe("removeCopiesOfTrip · 여행을 지울 때", () => {
  it("그 여행으로 보낸 엽서마다 사진 폴더를 비운다", async () => {
    const f = fake({ postcardsOfTrip: [{ id: "pc1" }, { id: "pc2" }] });
    f.folder.push("a.webp");
    expect(await removeCopiesOfTrip(f.supabase, "t1")).toBe(true);
    expect(f.log.filter((entry) => entry.startsWith("remove "))).toHaveLength(2);
  });

  it("엽서가 없으면 아무것도 안 하고 통과", async () => {
    const f = fake();
    expect(await removeCopiesOfTrip(f.supabase, "t1")).toBe(true);
    expect(f.log.some((entry) => entry.startsWith("remove "))).toBe(false);
  });

  it("사진을 못 지웠으면 실패 — 여행도 지우지 않게", async () => {
    const f = fake({ postcardsOfTrip: [{ id: "pc1" }], failRemove: true });
    f.folder.push("a.webp");
    expect(await removeCopiesOfTrip(f.supabase, "t1")).toBe(false);
  });

  it("엽서가 있는지 확인하지 못했으면 실패", async () => {
    expect(await removeCopiesOfTrip(fake({ selectError: "500" }).supabase, "t1")).toBe(false);
  });

  it("표가 아직 없으면(SQL 을 실행하기 전) 엽서가 없는 것으로 본다", async () => {
    expect(await removeCopiesOfTrip(fake({ selectError: "42P01" }).supabase, "t1")).toBe(true);
    expect(await removeCopiesOfTrip(fake({ selectError: "PGRST205" }).supabase, "t1")).toBe(true);
  });
});

describe("removeCopiesOfPhoto · 사진 한 장을 지울 때", () => {
  it("그 사진에서 나온 복사본을 지우고, 기록은 파일 뒤에 지운다", async () => {
    const f = fake({ photoRows: [{ postcard_id: "pc1", file: "a.webp" }, { postcard_id: "pc2", file: "b.webp" }] });
    expect(await removeCopiesOfPhoto(f.supabase, "p1")).toBe(true);
    const removeAt = f.log.findIndex((entry) => entry.startsWith("remove "));
    const deleteAt = f.log.findIndex((entry) => entry.startsWith("delete postcard_photos"));
    expect(removeAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(removeAt);
  });

  it("쓰인 엽서가 없으면 통과", async () => {
    expect(await removeCopiesOfPhoto(fake().supabase, "p1")).toBe(true);
  });

  it("복사본을 못 지웠으면 실패하고 기록은 남긴다", async () => {
    const f = fake({ photoRows: [{ postcard_id: "pc1", file: "a.webp" }], failRemove: true });
    expect(await removeCopiesOfPhoto(f.supabase, "p1")).toBe(false);
    expect(f.log.some((entry) => entry.startsWith("delete postcard_photos"))).toBe(false);
  });

  it("표가 없으면(SQL 전) 통과", async () => {
    expect(await removeCopiesOfPhoto(fake({ selectError: "42P01" }).supabase, "p1")).toBe(true);
  });
});

describe("withdrawPostcard · 엽서 거두기", () => {
  it("파일을 먼저 지우고 엽서 줄을 지운다", async () => {
    const f = fake();
    f.folder.push("a.webp");
    expect(await withdrawPostcard(f.supabase, "pc1")).toBe(true);
    expect(f.log).toEqual(["remove 1", "delete postcards id=pc1"]);
  });

  it("파일을 못 지웠으면 줄도 남긴다 — 다시 누르면 된다", async () => {
    const f = fake({ failRemove: true });
    f.folder.push("a.webp");
    expect(await withdrawPostcard(f.supabase, "pc1")).toBe(false);
    expect(f.log).not.toContain("delete postcards id=pc1");
  });
});

describe("지울 때 보여 줄 숫자", () => {
  it("여행마다 보낸 엽서 수", async () => {
    const f = fake({ countRows: [{ trip_id: "t1" }, { trip_id: "t1" }, { trip_id: "t2" }] });
    const counts = await fetchPostcardCounts(f.supabase, "u");
    expect(counts.get("t1")).toBe(2);
    expect(counts.get("t2")).toBe(1);
    expect(counts.get("t3")).toBeUndefined();
  });

  it("못 읽으면 빈 표 — 확인 창이 숫자를 못 보여 줄 뿐 지우기는 막지 않는다", async () => {
    expect((await fetchPostcardCounts(fake({ selectError: "500" }).supabase, "u")).size).toBe(0);
  });

  it("엽서에 쓰인 사진 id 들", async () => {
    const f = fake({ inPostcards: [{ source_photo_id: "p1" }, { source_photo_id: "p1" }, { source_photo_id: "p2" }] });
    expect([...(await fetchPhotosInPostcards(f.supabase, ["p1", "p2", "p3"]))].sort()).toEqual(["p1", "p2"]);
    expect((await fetchPhotosInPostcards(f.supabase, [])).size).toBe(0);
  });
});

describe("fetchSentPostcards · 보낸 엽서 목록", () => {
  it("엽서마다 제목·날짜·어느 우편함에 넣었는지·열어 봤는지", async () => {
    const f = fake({
      sentRows: [
        { id: "pc1", trip_id: "t1", created_at: "2026-10-02T00:00:00Z", snapshot: { title: "강릉 바다", startedOn: "2026-09-13" } },
        { id: "pc2", trip_id: "t2", created_at: "2026-10-01T00:00:00Z", snapshot: { title: null, startedOn: "2026-08-01" } },
      ],
      deliveryRows: [
        { postcard_id: "pc1", mailbox_id: "m1", opened_at: "2026-10-03T00:00:00Z" },
        { postcard_id: "pc1", mailbox_id: "m2", opened_at: null },
      ],
    });
    const list = await fetchSentPostcards(f.supabase, "u");
    expect(list).toEqual([
      {
        id: "pc1",
        tripId: "t1",
        title: "강릉 바다",
        startedOn: "2026-09-13",
        sentAt: "2026-10-02T00:00:00Z",
        deliveries: [
          { mailboxId: "m1", opened: true },
          { mailboxId: "m2", opened: false },
        ],
        replies: [],
        unread: 0,
      },
      { id: "pc2", tripId: "t2", title: null, startedOn: "2026-08-01", sentAt: "2026-10-01T00:00:00Z", deliveries: [], replies: [], unread: 0 },
    ]);
  });

  it("못 읽으면 빈 목록", async () => {
    expect(await fetchSentPostcards(fake({ selectError: "500" }).supabase, "u")).toEqual([]);
  });
});

describe("답장 알림 · 보낸 사람이 받는 소식", () => {
  const cards = [{ id: "pc1", trip_id: "t1", created_at: "2026-10-02T00:00:00Z", snapshot: { title: "강릉 바다", startedOn: "2026-09-13" } }];

  it("엽서마다 답장이 오고, 아직 못 본 것은 새 답장으로 센다", async () => {
    const f = fake({
      sentRows: cards,
      replyRows: [
        { id: "r1", postcard_id: "pc1", mailbox_id: "m1", who: "엄마", reaction: "좋구나", created_at: "2026-10-03T00:00:00Z", seen_at: "2026-10-03T01:00:00Z" },
        { id: "r2", postcard_id: "pc1", mailbox_id: "m2", who: "장모님", reaction: "잘 다녀왔니", created_at: "2026-10-04T00:00:00Z", seen_at: null },
        { id: "r3", postcard_id: "other", mailbox_id: "m1", who: "아빠", reaction: "좋구나", created_at: "2026-10-04T00:00:00Z", seen_at: null },
      ],
    });
    const [card] = await fetchSentPostcards(f.supabase, "u");
    expect(card.replies).toEqual([
      { id: "r1", mailboxId: "m1", who: "엄마", reaction: "좋구나", at: "2026-10-03T00:00:00Z", seen: true },
      { id: "r2", mailboxId: "m2", who: "장모님", reaction: "잘 다녀왔니", at: "2026-10-04T00:00:00Z", seen: false },
    ]);
    expect(card.unread).toBe(1);
  });

  it("답장이 없으면 빈 목록", async () => {
    const f = fake({ sentRows: cards });
    const [card] = await fetchSentPostcards(f.supabase, "u");
    expect(card.replies).toEqual([]);
    expect(card.unread).toBe(0);
  });

  it("못 본 답장의 수 — 위 띠에 점으로 알린다", async () => {
    expect(await fetchUnreadReplyCount(fake({ unread: 3 }).supabase)).toBe(3);
    expect(await fetchUnreadReplyCount(fake({ unread: 0 }).supabase)).toBe(0);
  });

  it("수를 못 세면 0 — 알림이 없는 것처럼 조용히", async () => {
    expect(await fetchUnreadReplyCount(fake({ selectError: "500" }).supabase)).toBe(0);
    expect(await fetchUnreadReplyCount(fake({ selectError: "42P01" }).supabase)).toBe(0);
  });

  it("봤다고 표시한다 — 그 답장들에만, 본 시각을 적는다", async () => {
    const f = fake();
    expect(await markRepliesSeen(f.supabase, ["r1", "r2"])).toBe(true);
    expect(f.updated).toHaveLength(1);
    expect(f.updated[0].ids).toEqual(["r1", "r2"]);
    expect(f.updated[0].patch.seen_at).toEqual(expect.any(String));
  });

  it("표시할 것이 없으면 묻지 않고, 실패하면 false", async () => {
    const f = fake();
    expect(await markRepliesSeen(f.supabase, [])).toBe(true);
    expect(f.log).toHaveLength(0);
    expect(await markRepliesSeen(fake({ failUpdate: true }).supabase, ["r1"])).toBe(false);
  });
});
