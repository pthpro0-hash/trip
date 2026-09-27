// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShareSnapshot } from "@/lib/share";

vi.mock("./photos", () => ({
  thumbUrls: vi.fn(async (_supabase: unknown, paths: string[]) => new Map(paths.map((path) => [path, `https://signed/${path}`]))),
}));

const { fetchOwnShare, fetchSharedSketch, publishShare, revokeShare, SHARE_BUCKET } = await import("./shares");

/** 무엇이 어떤 차례로 불렸는지 적어 두는 가짜 Supabase. */
function fakeSupabase(
  options: {
    failUpload?: (path: string) => boolean;
    failRemove?: boolean;
    failList?: boolean;
    /** 폴더에 이미 있는 파일(다른 기기에서 올린 것 등). */
    folder?: string[];
    /** 넣기가 겹침으로 막힌다 — 같은 해의 줄이 이미 있다. */
    rowExists?: { id: string; snapshot: ShareSnapshot };
    rpc?: unknown;
  } = {},
) {
  const log: string[] = [];
  const writes: { kind: "insert" | "update"; id: string; snapshot: ShareSnapshot }[] = [];
  const uploaded: string[] = [];
  const client = {
    from: (table: string) => ({
      insert: async (row: { id: string; snapshot: ShareSnapshot }) => {
        log.push(`insert ${table}`);
        if (options.rowExists) return { error: { code: "23505", message: "duplicate" } };
        writes.push({ kind: "insert", id: row.id, snapshot: row.snapshot });
        return { error: null };
      },
      update: (row: { snapshot: ShareSnapshot }) => ({
        eq: (_column: string, id: string) => ({
          select: async () => {
            log.push(`update ${table} id=${id}`);
            writes.push({ kind: "update", id, snapshot: row.snapshot });
            return { data: [{ id }], error: null };
          },
        }),
      }),
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: options.rowExists
                ? { id: options.rowExists.id, scope: "photos", updated_at: "", snapshot: options.rowExists.snapshot }
                : null,
              error: null,
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: async (column: string, value: string) => {
          log.push(`delete ${table} ${column}=${value}`);
          return { error: null };
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          log.push(`upload ${bucket}/${path}`);
          if (options.failUpload?.(path)) return { error: { message: "nope" } };
          uploaded.push(path.split("/")[1]);
          return { error: null };
        },
        list: async (folder: string) => {
          log.push(`list ${bucket}/${folder}`);
          if (options.failList) return { data: null, error: { message: "nope" } };
          return { data: [...(options.folder ?? []), ...uploaded].map((name) => ({ name })), error: null };
        },
        remove: async (paths: string[]) => {
          log.push(`remove ${bucket} ${paths.join(",")}`);
          return { error: options.failRemove ? { message: "nope" } : null };
        },
      }),
    },
    rpc: async (name: string, args: unknown) => {
      log.push(`rpc ${name} ${JSON.stringify(args)}`);
      return { data: options.rpc ?? null, error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, log, writes };
}

const snapshot = (files: string[], cover: string | null): ShareSnapshot => ({
  v: 1,
  year: 2026,
  scope: "photos",
  card: "map",
  headline: "바다",
  stats: { tripCount: 1, placeCount: 1, photoCount: 1, distanceKm: 0, spanDays: 1, curatedCount: 0 },
  months: [],
  dots: [],
  paths: [],
  story: {
    seasons: [],
    seasonLine: null,
    distanceWords: null,
    sido: [],
    firstSido: null,
    topPlace: null,
    compare: null,
    photos: files,
  },
  files,
  cover,
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.includes("broken") ? new Response(null, { status: 404 }) : new Response(new Blob(["x"], { type: "image/webp" })),
    ),
  );
});

const build = (files: Map<string, string>, cover: string | null) => snapshot([...files.values()], cover);

const publishInput = (overrides: Partial<Parameters<typeof publishShare>[1]> = {}) => ({
  userId: "u1",
  year: 2026,
  scope: "photos" as const,
  existing: null,
  photoPaths: ["u1/a.webp", "u1/b.webp"],
  cover: new Blob(["png"]),
  build,
  ...overrides,
});

const oldShare = (files: string[]) => ({
  id: "keepThisLinkId1234",
  scope: "photos" as const,
  updatedAt: "",
  snapshot: snapshot(files, null),
});

describe("publishShare", () => {
  it("줄을 먼저 넣고 사진을 올린다 — 보관함은 줄을 보고 주인을 가린다", async () => {
    const { client, log } = fakeSupabase();
    const published = await publishShare(client, publishInput());
    expect(published?.clean).toBe(true);
    expect(log[0]).toBe("insert sketch_shares");
    const uploads = log.filter((line) => line.startsWith("upload"));
    expect(uploads).toHaveLength(3);
    for (const line of uploads) expect(line.startsWith(`upload ${SHARE_BUCKET}/${published!.id}/`)).toBe(true);
    // 원본 경로(사용자 id 가 든)는 올린 이름에 드러나지 않는다.
    expect(uploads.some((line) => line.includes("u1/"))).toBe(false);
  });

  it("못 옮긴 사진은 스냅샷에서 뺀다", async () => {
    const { client, writes } = fakeSupabase();
    await publishShare(client, publishInput({ photoPaths: ["u1/a.webp", "u1/broken.webp"], cover: null }));
    expect(writes.map((write) => write.kind)).toEqual(["insert", "update"]);
    expect(writes[0].snapshot.files).toHaveLength(2);
    expect(writes[1].snapshot.files).toHaveLength(1);
  });

  it("고쳐 만들면 같은 주소 — 넣지 않고 그 주소를 고친다", async () => {
    const { client, log, writes } = fakeSupabase();
    const published = await publishShare(client, publishInput({ scope: "map", existing: oldShare(["old-0.webp"]), photoPaths: [] }));
    expect(published?.id).toBe("keepThisLinkId1234");
    expect(log.some((line) => line.startsWith("insert"))).toBe(false);
    expect(writes.every((write) => write.id === "keepThisLinkId1234")).toBe(true);
  });

  it("폴더를 통째로 보고, 지금 판이 쓰지 않는 파일은 다 지운다 — 스냅샷에 없던 것까지", async () => {
    // "stray-3.webp": 다른 기기에서 올렸거나 중간에 끊긴 판의 파일.
    const { client, log } = fakeSupabase({ folder: ["old-0.webp", "stray-3.webp"] });
    const published = await publishShare(client, publishInput({ scope: "map", existing: oldShare(["old-0.webp"]), photoPaths: [] }));
    expect(published?.clean).toBe(true);
    const removal = log.find((line) => line.startsWith("remove"))!;
    expect(removal).toContain("keepThisLinkId1234/old-0.webp");
    expect(removal).toContain("keepThisLinkId1234/stray-3.webp");
    expect(removal).not.toContain("card.png");
  });

  it("예전 파일을 못 지웠으면 그렇다고 알린다", async () => {
    const { client } = fakeSupabase({ folder: ["old-0.webp"], failRemove: true });
    const published = await publishShare(client, publishInput({ scope: "map", existing: oldShare(["old-0.webp"]), photoPaths: [] }));
    expect(published?.clean).toBe(false);
  });

  it("다른 기기에서 먼저 만들어 두었으면 새 주소를 만들지 않고 그 주소를 고친다", async () => {
    const other = { id: "madeOnPhoneLinkId1", snapshot: snapshot([], null) };
    const { client, log } = fakeSupabase({ rowExists: other });
    const published = await publishShare(client, publishInput({ photoPaths: [] }));
    expect(published?.id).toBe("madeOnPhoneLinkId1");
    expect(log).toContain("update sketch_shares id=madeOnPhoneLinkId1");
  });
});

describe("revokeShare", () => {
  const share = { id: "revokeThisLinkId12", scope: "photos" as const, updatedAt: "", snapshot: snapshot(["k-0.webp"], "k-card.png") };

  it("폴더를 비우고 줄을 지운다 — 스냅샷에 없던 파일까지", async () => {
    const { client, log } = fakeSupabase({ folder: ["k-0.webp", "k-card.png", "stray.webp"] });
    expect(await revokeShare(client, share)).toBe(true);
    expect(log).toEqual([
      `list ${SHARE_BUCKET}/revokeThisLinkId12`,
      `remove ${SHARE_BUCKET} revokeThisLinkId12/k-0.webp,revokeThisLinkId12/k-card.png,revokeThisLinkId12/stray.webp`,
      "delete sketch_shares id=revokeThisLinkId12",
    ]);
  });

  it("사진을 못 지웠으면 줄도 남긴다 — 줄이 없으면 다시는 지울 수 없다", async () => {
    const { client, log } = fakeSupabase({ folder: ["k-0.webp"], failRemove: true });
    expect(await revokeShare(client, share)).toBe(false);
    expect(log.some((line) => line.startsWith("delete"))).toBe(false);
  });

  it("폴더를 못 봤으면 줄도 남긴다", async () => {
    const { client, log } = fakeSupabase({ failList: true });
    expect(await revokeShare(client, share)).toBe(false);
    expect(log.some((line) => line.startsWith("delete"))).toBe(false);
  });
});

describe("fetchSharedSketch", () => {
  it("id 하나로만 묻는다", async () => {
    const { client, log } = fakeSupabase({ rpc: { id: "abcdefghijklmnop", snapshot: snapshot([], null), updatedAt: "2026-09-27" } });
    const found = await fetchSharedSketch(client, "abcdefghijklmnop");
    expect(found?.snapshot.headline).toBe("바다");
    expect(log).toEqual(['rpc shared_sketch {"share_id":"abcdefghijklmnop"}']);
  });

  it("없거나 모르는 판이면 null", async () => {
    expect(await fetchSharedSketch(fakeSupabase().client, "abcdefghijklmnop")).toBeNull();
    const odd = fakeSupabase({ rpc: { id: "x", snapshot: { v: 9 } } });
    expect(await fetchSharedSketch(odd.client, "abcdefghijklmnop")).toBeNull();
  });
});

describe("publicFileUrl", () => {
  it("스냅샷의 파일 이름이 링크 폴더 밖을 가리키지 못한다", async () => {
    const { publicFileUrl } = await import("./shares");
    const url = publicFileUrl("abcdefghijklmnop", "../../trip-photos/u1/a.webp");
    expect(url).toContain("/shared-sketches/abcdefghijklmnop/");
    expect(url).not.toContain("../");
  });
});

describe("fetchOwnShare", () => {
  it("모양이 틀린 줄이어도 주소는 돌려준다 — 끊을 수는 있어야 한다", async () => {
    const broken = { id: "brokenRowLinkId123", snapshot: { v: 9 } as unknown as ShareSnapshot };
    const { client } = fakeSupabase({ rowExists: broken });
    const found = await fetchOwnShare(client, "u1", 2026);
    expect(found).not.toBe("failed");
    expect(found && found !== "failed" ? found.id : null).toBe("brokenRowLinkId123");
    expect(found && found !== "failed" ? found.snapshot : "x").toBeNull();
  });
});
