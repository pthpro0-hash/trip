// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripDetail } from "./tripDetail";
import { fetchOwnTripShare, fetchSharedTrip, publishTripShare, revokeTripShare } from "./tripShares";
import { deleteTrip } from "./trips";

/*
  순서가 전부다. 만들 때는 줄이 먼저(보관함이 줄을 보고 주인을 가린다),
  끊을 때는 폴더가 먼저(줄이 없으면 사진을 지울 길이 없다). 여행을 지울 때는
  링크부터 끊는다 — 여행 줄이 사라지면 링크 줄도 함께 사라진다.
*/

const trip: TripDetail = {
  id: "t1",
  title: "강릉",
  subtitle: null,
  startedOn: "2026-09-13",
  endedOn: "2026-09-13",
  companions: null,
  note: null,
  visits: [
    {
      id: "v1",
      placeName: "안목해변",
      spotId: null,
      dong: null,
      lat: 37.77,
      lng: 128.94,
      startedAt: new Date("2026-09-13T09:00:00"),
      endedAt: new Date("2026-09-13T10:00:00"),
      photos: [
        { id: "p1", storagePath: "u/v1/a.webp", takenAt: new Date("2026-09-13T09:00:00"), isCover: true },
        { id: "p2", storagePath: "u/v1/b.webp", takenAt: new Date("2026-09-13T09:30:00"), isCover: false },
      ],
    },
  ],
};

interface Fake {
  log: string[];
  folder: string[];
  rows: { id: string; snapshot?: { files?: string[] } }[];
}

/** 보관함과 표를 흉내 낸다. 무엇을 어떤 순서로 했는지 log 에 적는다. */
function fake(options: { insertError?: string; failUploadOf?: string; failRemove?: boolean; selectError?: string } = {}) {
  const state: Fake = { log: [], folder: [], rows: [] };
  const table = {
    insert: async (row: { id: string; snapshot: { files: string[] } }) => {
      state.log.push("insert");
      if (options.insertError) return { error: { code: options.insertError } };
      state.rows.push(row);
      return { error: null };
    },
    update: (patch: { snapshot: { files: string[] } }) => ({
      eq: () => ({
        select: async () => {
          state.log.push("update");
          if (state.rows[0]) state.rows[0].snapshot = patch.snapshot;
          return { data: state.rows.length ? [{ id: state.rows[0].id }] : [], error: null };
        },
      }),
    }),
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (options.selectError) return { data: null, error: { code: options.selectError } };
            return {
              data: state.rows[0] ? { id: state.rows[0].id, updated_at: "2026-09-29T00:00:00Z" } : null,
              error: null,
            };
          },
        }),
      }),
    }),
    delete: () => ({
      eq: async () => {
        state.log.push("delete-row");
        state.rows.length = 0;
        return { error: null };
      },
    }),
  };
  const supabase = {
    from: () => table,
    rpc: async () => ({ data: null, error: null }),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://예시/${path}` })),
          error: null,
        }),
        upload: async (path: string) => {
          state.log.push("upload");
          if (options.failUploadOf && path.endsWith(options.failUploadOf)) return { error: { message: "nope" } };
          state.folder.push(path.split("/").slice(1).join("/"));
          return { error: null };
        },
        list: async () => ({ data: state.folder.map((name) => ({ name })), error: null }),
        remove: async (paths: string[]) => {
          state.log.push("remove");
          if (options.failRemove) return { error: { message: "nope" } };
          const gone = new Set(paths.map((p) => p.split("/").slice(1).join("/")));
          state.folder = state.folder.filter((name) => !gone.has(name));
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
  return { supabase, state };
}

beforeEach(() => {
  vi.stubGlobal("fetch", async () => ({ ok: true, blob: async () => new Blob(["x"], { type: "image/webp" }) }));
});

describe("publishTripShare", () => {
  it("줄을 먼저 적고 그다음 사진을 올린다", async () => {
    const { supabase, state } = fake();
    const published = await publishTripShare(supabase, "u", trip, null);

    expect(published?.clean).toBe(true);
    expect(state.log.slice(0, 3)).toEqual(["insert", "upload", "upload"]);
    expect(state.rows[0].snapshot?.files).toHaveLength(2);
    expect(state.folder).toHaveLength(2);
  });

  it("이미 만든 링크가 있으면 새 줄을 넣지 않고 그 주소를 고친다", async () => {
    const { supabase, state } = fake();
    state.rows.push({ id: "existing-id-1234567890" });
    const published = await publishTripShare(supabase, "u", trip, { id: "existing-id-1234567890", updatedAt: "" });

    expect(published?.id).toBe("existing-id-1234567890");
    expect(state.log).not.toContain("insert");
    expect(state.log[0]).toBe("update");
  });

  it("다른 기기에서 먼저 만들었으면(겹침) 그 줄을 찾아 고친다", async () => {
    const { supabase, state } = fake({ insertError: "23505" });
    state.rows.push({ id: "other-device-id-123456" });
    const published = await publishTripShare(supabase, "u", trip, null);

    expect(published?.id).toBe("other-device-id-123456");
  });

  it("다른 이유로 줄을 못 넣으면 사진을 올리지 않는다", async () => {
    const { supabase, state } = fake({ insertError: "42501" });
    expect(await publishTripShare(supabase, "u", trip, null)).toBeNull();
    expect(state.log).toEqual(["insert"]);
  });

  it("못 올린 사진은 스냅샷에서 뺀다", async () => {
    const { supabase, state } = fake({ failUploadOf: "-1.webp" });
    const published = await publishTripShare(supabase, "u", trip, null);

    expect(published).not.toBeNull();
    expect(state.rows[0].snapshot?.files).toHaveLength(1);
    expect(state.folder).toHaveLength(1);
  });

  it("예전 판의 파일은 치운다", async () => {
    const { supabase, state } = fake();
    state.folder.push("옛날-0.webp");
    const published = await publishTripShare(supabase, "u", trip, null);

    expect(published?.clean).toBe(true);
    expect(state.folder).not.toContain("옛날-0.webp");
  });
});

describe("revokeTripShare", () => {
  it("폴더를 먼저 비우고 줄을 지운다", async () => {
    const { supabase, state } = fake();
    state.folder.push("a.webp", "b.webp");
    state.rows.push({ id: "share-id-1234567890abc" });

    expect(await revokeTripShare(supabase, { id: "share-id-1234567890abc", updatedAt: "" })).toBe(true);
    expect(state.log).toEqual(["remove", "delete-row"]);
    expect(state.folder).toEqual([]);
  });

  it("사진을 못 지웠으면 줄을 남긴다 — 줄이 없으면 다시 지울 길이 없다", async () => {
    const { supabase, state } = fake({ failRemove: true });
    state.folder.push("a.webp");
    state.rows.push({ id: "share-id-1234567890abc" });

    expect(await revokeTripShare(supabase, { id: "share-id-1234567890abc", updatedAt: "" })).toBe(false);
    expect(state.rows).toHaveLength(1);
  });
});

describe("fetchOwnTripShare", () => {
  it("만든 링크가 없으면 null", async () => {
    expect(await fetchOwnTripShare(fake().supabase, "u", "t1")).toBeNull();
  });

  it("표가 아직 없으면(SQL 을 실행하기 전) 링크가 없는 것으로 본다", async () => {
    expect(await fetchOwnTripShare(fake({ selectError: "42P01" }).supabase, "u", "t1")).toBeNull();
    expect(await fetchOwnTripShare(fake({ selectError: "PGRST205" }).supabase, "u", "t1")).toBeNull();
  });

  it("다른 오류면 확인하지 못했다고 한다", async () => {
    expect(await fetchOwnTripShare(fake({ selectError: "500" }).supabase, "u", "t1")).toBe("failed");
  });
});

describe("fetchSharedTrip", () => {
  it("모양이 틀린 스냅샷은 돌려주지 않는다", async () => {
    const supabase = {
      rpc: async () => ({ data: { id: "x", snapshot: { v: 9 }, updatedAt: "" }, error: null }),
    } as unknown as SupabaseClient;
    expect(await fetchSharedTrip(supabase, "x")).toBeNull();
  });
});

describe("deleteTrip · 링크로 보여 주던 여행", () => {
  /** 여행 지우기가 부르는 표까지 흉내 낸다. */
  function withTrips(base: ReturnType<typeof fake>) {
    const original = base.supabase.from.bind(base.supabase);
    const supabase = {
      ...base.supabase,
      storage: base.supabase.storage,
      from: (name: string) => {
        if (name === "trip_photos") {
          return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) };
        }
        if (name === "trips") {
          return {
            delete: () => ({
              eq: () => ({
                eq: async () => {
                  base.state.log.push("delete-trip");
                  return { error: null };
                },
              }),
            }),
          };
        }
        return original(name);
      },
    } as unknown as SupabaseClient;
    return supabase;
  }

  it("링크부터 끊고 여행을 지운다", async () => {
    const base = fake();
    base.state.folder.push("a.webp");
    base.state.rows.push({ id: "share-id-1234567890abc" });

    expect(await deleteTrip(withTrips(base), "u", "t1")).toBe(true);
    expect(base.state.log).toEqual(["remove", "delete-row", "delete-trip"]);
  });

  it("링크의 사진을 못 지웠으면 여행도 지우지 않는다", async () => {
    const base = fake({ failRemove: true });
    base.state.folder.push("a.webp");
    base.state.rows.push({ id: "share-id-1234567890abc" });

    expect(await deleteTrip(withTrips(base), "u", "t1")).toBe(false);
    expect(base.state.log).not.toContain("delete-trip");
  });

  it("링크가 있는지 확인하지 못했으면 여행을 지우지 않는다", async () => {
    const base = fake({ selectError: "500" });
    expect(await deleteTrip(withTrips(base), "u", "t1")).toBe(false);
    expect(base.state.log).not.toContain("delete-trip");
  });

  it("링크가 없던 여행은 그대로 지운다", async () => {
    const base = fake();
    expect(await deleteTrip(withTrips(base), "u", "t1")).toBe(true);
    expect(base.state.log).toEqual(["delete-trip"]);
  });
});
