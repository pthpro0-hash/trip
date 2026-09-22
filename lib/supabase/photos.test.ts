// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PHOTO_LIMIT, UPLOAD_LANES, uploadPhotos, type UploadTarget } from "./photos";
import { UnsupportedImageError } from "@/lib/photo/resize";

/*
  올리기는 지금까지 한 번도 대량으로 돌려 본 적이 없다. 한 장씩 차례로
  올리면 200장에 몇 분이 걸리므로 올리기만 나란히 하게 고쳤는데, 나란히
  돌리는 코드는 눈으로 읽어서는 맞는지 알 수 없다. 여기서 못 박는다.
*/

const shrink = vi.fn<(file: File) => Promise<Blob>>();
vi.mock("@/lib/photo/resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photo/resize")>()),
  shrinkToWebp: (file: File) => shrink(file),
}));

function target(name: string): UploadTarget {
  return {
    visitId: "v1",
    file: new File(["x"], name, { type: "image/jpeg" }),
    takenAt: new Date("2026-09-14T09:00"),
    lat: 37.7728,
    lng: 128.9474,
    isCover: false,
  };
}

interface FakeOptions {
  already?: number;
  /** 이 이름들은 올리다 실패한다. */
  uploadFails?: string[];
  /** 이 이름들은 표에 넣다 실패한다. */
  rowFails?: string[];
}

/*
  보관함 경로는 uuid 라 파일 이름이 남지 않는다. 줄인 결과(Blob)에 이름을
  담아 두고, 경로와 이름을 짝지어 둬야 "이 장만 실패" 를 만들 수 있다.
*/

function fakeSupabase(options: FakeOptions = {}) {
  const state = {
    /** 지금 망에 떠 있는 장 수. */
    inFlight: 0,
    peak: 0,
    inserted: [] as Record<string, unknown>[],
    removed: [] as string[],
    nameOf: new Map<string, string>(),
    /** 올리기를 붙들어 두는 손잡이. 풀어 주기 전까지 끝나지 않는다. */
    release: [] as (() => void)[],
  };

  const supabase = {
    from: (table: string) => ({
      select: () => ({
        eq: async () => ({ count: options.already ?? 0, error: null }),
      }),
      insert: async (row: Record<string, unknown>) => {
        const name = state.nameOf.get(String(row.storage_path)) ?? "";
        if ((options.rowFails ?? []).includes(name)) return { error: { message: "nope" } };
        state.inserted.push({ table, ...row });
        return { error: null };
      },
    }),
    storage: {
      from: () => ({
        upload: async (path: string, blob: Blob) => {
          const name = await blob.text();
          state.nameOf.set(path, name);
          state.inFlight += 1;
          state.peak = Math.max(state.peak, state.inFlight);
          // 아무도 풀어 주지 않으면 그대로 떠 있다.
          await new Promise<void>((resolve) => state.release.push(resolve));
          state.inFlight -= 1;
          return { error: (options.uploadFails ?? []).includes(name) ? { message: "nope" } : null };
        },
        remove: async (paths: string[]) => {
          state.removed.push(...paths);
          return { error: null };
        },
      }),
    },
  };

  return { supabase: supabase as unknown as SupabaseClient, state };
}

/**
 * 떠 있는 것들을 계속 풀어 주며 끝까지 굴린다.
 *
 * 줄이는 동안에는 잠깐 떠 있는 것이 하나도 없다. 그때 멈추면 영영
 * 끝나지 않으므로, 비었다고 그만두지 않고 끝날 때까지 돌린다.
 */
async function 끝까지<T>(state: { release: (() => void)[] }, run: Promise<T>): Promise<T> {
  let settled = false;
  const mark = () => {
    settled = true;
  };
  void run.then(mark, mark);

  for (let turn = 0; turn < 5_000 && !settled; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    state.release.splice(0).forEach((release) => release());
  }
  return run;
}

describe("uploadPhotos", () => {
  beforeEach(() => {
    shrink.mockReset();
    // 파일 이름을 그대로 물고 가야 어느 장이 실패했는지 가릴 수 있다.
    shrink.mockImplementation(async (file) => new Blob([file.name]));
  });

  it("빈 목록이면 셈만 돌려주고 아무것도 묻지 않는다", async () => {
    const { supabase, state } = fakeSupabase();
    const outcome = await uploadPhotos(supabase, "나", []);
    expect(outcome).toEqual({ uploaded: 0, unsupported: [], failed: 0, overLimit: 0 });
    expect(state.inserted).toHaveLength(0);
  });

  it("네 장까지만 한꺼번에 띄운다", async () => {
    const { supabase, state } = fakeSupabase();
    const targets = Array.from({ length: 20 }, (_, i) => target(`${i}.jpg`));

    const run = uploadPhotos(supabase, "나", targets);
    await 끝까지(state, run);
    const outcome = await run;

    expect(outcome.uploaded).toBe(20);
    expect(state.peak).toBe(UPLOAD_LANES);
  });

  it("줄이기는 한 장씩 한다 — 펼친 그림이 둘 이상 살아 있지 않게", async () => {
    const { supabase, state } = fakeSupabase();
    let shrinking = 0;
    let shrinkPeak = 0;
    shrink.mockImplementation(async (file) => {
      shrinking += 1;
      shrinkPeak = Math.max(shrinkPeak, shrinking);
      await new Promise((resolve) => setTimeout(resolve, 0));
      shrinking -= 1;
      return new Blob([file.name]);
    });

    const run = uploadPhotos(supabase, "나", Array.from({ length: 12 }, (_, i) => target(`${i}.jpg`)));
    await 끝까지(state, run);
    await run;

    expect(shrinkPeak).toBe(1);
  });

  it("끝난 차례가 아니라 사진 차례대로 센다", async () => {
    const { supabase, state } = fakeSupabase();
    shrink.mockImplementation(async (file) => {
      if (file.name === "b.jpg" || file.name === "d.jpg") {
        throw new UnsupportedImageError(file.name);
      }
      return new Blob([file.name]);
    });

    const run = uploadPhotos(
      supabase,
      "나",
      ["a.jpg", "b.jpg", "c.jpg", "d.jpg"].map(target),
    );
    await 끝까지(state, run);
    const outcome = await run;

    expect(outcome.uploaded).toBe(2);
    expect(outcome.unsupported).toEqual(["b.jpg", "d.jpg"]);
  });

  it("표에 넣다 실패하면 방금 올린 파일을 지운다", async () => {
    const { supabase, state } = fakeSupabase({ rowFails: ["b.jpg"] });
    const run = uploadPhotos(supabase, "나", ["a.jpg", "b.jpg", "c.jpg"].map(target));
    await 끝까지(state, run);
    const outcome = await run;

    expect(outcome.uploaded).toBe(2);
    expect(outcome.failed).toBe(1);
    // 아무도 가리키지 않는 파일이 보관함에 남지 않는다.
    expect(state.removed).toHaveLength(1);
  });

  it("한 장이 망에서 실패해도 나머지는 그대로 올라간다", async () => {
    const { supabase, state } = fakeSupabase({ uploadFails: ["2.jpg"] });
    const run = uploadPhotos(supabase, "나", Array.from({ length: 10 }, (_, i) => target(`${i}.jpg`)));
    await 끝까지(state, run);
    const outcome = await run;

    expect(outcome.uploaded).toBe(9);
    expect(outcome.failed).toBe(1);
    // 올리다 실패한 것은 지울 파일도 없다.
    expect(state.removed).toHaveLength(0);
  });

  it("상한을 넘겨 올리지 않는다", async () => {
    const { supabase, state } = fakeSupabase({ already: PHOTO_LIMIT - 3 });
    const run = uploadPhotos(supabase, "나", Array.from({ length: 10 }, (_, i) => target(`${i}.jpg`)));
    await 끝까지(state, run);
    const outcome = await run;

    // 나란히 올려도 남은 세 자리를 넘기지 않는다.
    expect(outcome.uploaded).toBe(3);
    expect(outcome.overLimit).toBe(7);
    expect(state.inserted).toHaveLength(3);
  });

  it("이미 상한을 채웠으면 한 장도 올리지 않는다", async () => {
    const { supabase, state } = fakeSupabase({ already: PHOTO_LIMIT });
    const run = uploadPhotos(supabase, "나", ["a.jpg", "b.jpg"].map(target));
    await 끝까지(state, run);
    const outcome = await run;

    expect(outcome).toEqual({ uploaded: 0, unsupported: [], failed: 0, overLimit: 2 });
    // 올리지 않을 사진은 줄이지도 않는다.
    expect(shrink).not.toHaveBeenCalled();
  });

  it("몇 장째인지 알린다", async () => {
    const { supabase, state } = fakeSupabase();
    const seen: number[] = [];
    const run = uploadPhotos(
      supabase,
      "나",
      Array.from({ length: 6 }, (_, i) => target(`${i}.jpg`)),
      (done) => seen.push(done),
    );
    await 끝까지(state, run);
    await run;

    expect(seen[0]).toBe(0);
    expect(seen.at(-1)).toBe(6);
    // 뒤로 가지 않는다.
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });
});
