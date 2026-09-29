// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SIGNED_URL_SECONDS,
  backfillThumbs,
  PHOTO_LIMIT,
  UPLOAD_LANES,
  legacyThumbPath,
  markerPath,
  markerUrls,
  missingThumbs,
  reshrinkPhotos,
  thumbPath,
  thumbUrls,
  uploadPhotos,
  type UploadTarget,
} from "./photos";
import { MARKER_EDGE, THUMB_EDGE } from "@/lib/photo/resize";
import { UnsupportedImageError } from "@/lib/photo/resize";

/*
  올리기는 지금까지 한 번도 대량으로 돌려 본 적이 없다. 한 장씩 차례로
  올리면 200장에 몇 분이 걸리므로 올리기만 나란히 하게 고쳤는데, 나란히
  돌리는 코드는 눈으로 읽어서는 맞는지 알 수 없다. 여기서 못 박는다.
*/

const shrink = vi.fn<(file: File) => Promise<{ full: Blob; thumb: Blob; marker: Blob }>>();
vi.mock("@/lib/photo/resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/photo/resize")>()),
  shrinkToWebp: (file: File) => shrink(file),
  // node 에는 createImageBitmap 이 없다. 줄이는 일 자체는 여기서 볼 것이 아니다.
  thumbFromBlob: async () => new Blob(["t"]),
  markerFromBlob: async () => new Blob(["m"]),
  reshrink: (blob: Blob) => reshrinkMock(blob),
}));
const reshrinkMock = vi.fn<(blob: Blob) => Promise<{ full: Blob; thumb: Blob; marker: Blob }>>();

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
    thumbs: [] as string[],
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
          // 작은 판은 큰 판을 따라 올라올 뿐이라 세지도 붙들지도 않는다.
          if (name.startsWith("t:")) {
            state.thumbs.push(path);
            return { error: null };
          }
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
    shrink.mockImplementation(async (file) => ({
      full: new Blob([file.name]),
      thumb: new Blob([`t:${file.name}`]),
      marker: new Blob([`t:m:${file.name}`]),
    }));
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
      return {
        full: new Blob([file.name]),
        thumb: new Blob([`t:${file.name}`]),
        marker: new Blob([`t:m:${file.name}`]),
      };
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
      return {
        full: new Blob([file.name]),
        thumb: new Blob([`t:${file.name}`]),
        marker: new Blob([`t:m:${file.name}`]),
      };
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
    // 아무도 가리키지 않는 파일이 보관함에 남지 않는다. 작은 판들까지.
    expect(state.removed).toHaveLength(3);
    expect(state.removed[1]).toBe(thumbPath(state.removed[0]));
    expect(state.removed[2]).toBe(markerPath(state.removed[0]));
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

/*
  목록에 쓸 작은 판.

  48px 자리에 2048px 짜리 400KB 를 내려받고 있었다. 사람이 늘수록 이
  낭비가 곧 청구서가 된다. 다만 이미 올라간 사진에는 작은 판이 없으므로,
  없을 때 원본으로 물러나는 길이 반드시 살아 있어야 한다.
*/
describe("thumbPath", () => {
  it("이름에 크기를 박아 둔다", () => {
    // 크기가 이름에 있으면 "없다"는 답이 곧 "다시 만들어야 한다"가 된다.
    expect(thumbPath("나/v1/abc.webp")).toBe(`나/v1/abc.t${THUMB_EDGE}.webp`);
  });

  it("두 번 붙이지 않는다", () => {
    expect(thumbPath(thumbPath("나/v1/abc.webp"))).toBe(`나/v1/abc.t${THUMB_EDGE}.webp`);
  });

  it("크기를 바꾸면 이름이 달라진다 — 그래서 저절로 다시 만들어진다", () => {
    // 예전 480px 판은 지금 이름과 다르므로 "없는 것"으로 잡힌다.
    expect(thumbPath("나/v1/abc.webp")).not.toBe("나/v1/abc.t480.webp");
  });

  it("예전 이름도 따로 알아본다 — 다시 만든 뒤 치우려고", () => {
    expect(legacyThumbPath("나/v1/abc.webp")).toBe("나/v1/abc.thumb.webp");
    expect(legacyThumbPath(legacyThumbPath("나/v1/abc.webp"))).toBe("나/v1/abc.thumb.webp");
  });
});

describe("thumbUrls", () => {
  /** 이 경로들만 보관함에 있는 셈 친다. */
  function fakeStorage(있는것: string[]) {
    return {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) =>
              있는것.includes(path)
                ? { path, signedUrl: `https://예시/${path}` }
                : { path: null, signedUrl: null },
            ),
            error: null,
          }),
        }),
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
  }

  it("작은 판이 있으면 그것을 준다", async () => {
    const urls = await thumbUrls(fakeStorage([`나/v1/a.t${THUMB_EDGE}.webp`]), ["나/v1/a.webp"]);
    // 열쇠는 언제나 원본 경로다. 부르는 쪽은 무엇이 왔는지 몰라도 된다.
    expect(urls.get("나/v1/a.webp")).toBe(`https://예시/나/v1/a.t${THUMB_EDGE}.webp`);
  });

  it("작은 판이 없으면 원본으로 물러난다 — 예전에 올린 사진들", async () => {
    const urls = await thumbUrls(fakeStorage(["나/v1/a.webp"]), ["나/v1/a.webp"]);
    expect(urls.get("나/v1/a.webp")).toBe("https://예시/나/v1/a.webp");
  });

  it("섞여 있어도 각자 제 것을 찾아간다", async () => {
    const urls = await thumbUrls(fakeStorage([`나/v1/새.t${THUMB_EDGE}.webp`, "나/v1/옛.webp"]), [
      "나/v1/새.webp",
      "나/v1/옛.webp",
    ]);
    expect(urls.get("나/v1/새.webp")).toBe(`https://예시/나/v1/새.t${THUMB_EDGE}.webp`);
    expect(urls.get("나/v1/옛.webp")).toBe("https://예시/나/v1/옛.webp");
  });

  it("빈 목록에는 묻지 않는다", async () => {
    expect(await thumbUrls(fakeStorage([]), [])).toEqual(new Map());
  });
});

/*
  크기를 바꾸면 이름이 달라지므로 예전 판이 고아로 남는다.
  다시 만든 뒤 치우되, 순서가 중요하다 — 먼저 치우고 만들다 끊기면
  아무 판도 없는 사진이 생긴다.
*/
describe("backfillThumbs · 빠진 판 챙기기", () => {
  /** 보관함에 이 경로들만 있는 셈 친다. */
  function fake(있는것: string[], 옵션: { uploadFails?: boolean } = {}) {
    const state = { uploaded: [] as string[], removed: [] as string[], fetched: [] as string[] };
    const supabase = {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) =>
              있는것.includes(path)
                ? { path, signedUrl: `https://예시/${path}` }
                : { path: null, signedUrl: null },
            ),
            error: null,
          }),
          upload: async (path: string) => {
            if (옵션.uploadFails) return { error: { message: "nope" } };
            state.uploaded.push(path);
            return { error: null };
          },
          remove: async (paths: string[]) => {
            state.removed.push(...paths);
            return { error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;

    vi.stubGlobal("fetch", async (url: string) => {
      state.fetched.push(url);
      return { ok: true, blob: async () => new Blob(["x"]) };
    });
    return { supabase, state };
  }

  const 원본 = "나/v1/a.webp";

  it("목록 판이 없으면 원본에서 둘 다 만들고 예전 판을 치운다", async () => {
    const { supabase, state } = fake([원본]);
    const outcome = await backfillThumbs(supabase, [원본]);

    expect(outcome).toEqual({ made: 1, failed: 0 });
    expect(state.uploaded).toEqual([`나/v1/a.t${THUMB_EDGE}.webp`, `나/v1/a.t${MARKER_EDGE}.webp`]);
    expect(state.removed).toEqual(["나/v1/a.thumb.webp"]);
  });

  /*
    원본은 400KB, 목록 판은 87KB 다. 핀 판(160px)을 만드는 데는 목록
    판으로 차고 넘친다. 507장이면 200MB 와 44MB 의 차이다.
  */
  it("목록 판이 있으면 그것으로 핀 판만 만든다 — 원본은 받지 않는다", async () => {
    const { supabase, state } = fake([원본, thumbPath(원본)]);
    const outcome = await backfillThumbs(supabase, [원본]);

    expect(outcome).toEqual({ made: 1, failed: 0 });
    expect(state.uploaded).toEqual([markerPath(원본)]);
    expect(state.fetched).toEqual([`https://예시/${thumbPath(원본)}`]);
    expect(state.removed).toEqual([]);
  });

  it("만들지 못하면 예전 판을 치우지 않는다", async () => {
    const { supabase, state } = fake([원본], { uploadFails: true });
    const outcome = await backfillThumbs(supabase, [원본]);

    expect(outcome).toEqual({ made: 0, failed: 1 });
    // 치웠다면 아무 판도 없는 사진이 됐을 것이다.
    expect(state.removed).toEqual([]);
  });
});

describe("markerPath", () => {
  it("핀 판도 이름에 크기를 박는다", () => {
    expect(markerPath("나/v1/abc.webp")).toBe(`나/v1/abc.t${MARKER_EDGE}.webp`);
  });

  it("목록 판과 이름이 겹치지 않는다", () => {
    expect(markerPath("나/v1/abc.webp")).not.toBe(thumbPath("나/v1/abc.webp"));
  });
});

describe("markerUrls", () => {
  function fakeStorage(있는것: string[]) {
    return {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) =>
              있는것.includes(path)
                ? { path, signedUrl: `https://예시/${path}` }
                : { path: null, signedUrl: null },
            ),
            error: null,
          }),
        }),
      },
    } as unknown as SupabaseClient;
  }

  const a = "나/v1/a.webp";
  const b = "나/v1/b.webp";
  const c = "나/v1/c.webp";

  it("핀 판 → 목록 판 → 원본 순으로 물러난다", async () => {
    const urls = await markerUrls(fakeStorage([markerPath(a), thumbPath(b), c]), [a, b, c]);

    expect(urls.get(a)).toBe(`https://예시/${markerPath(a)}`);
    expect(urls.get(b)).toBe(`https://예시/${thumbPath(b)}`);
    expect(urls.get(c)).toBe(`https://예시/${c}`);
  });
});

describe("missingThumbs", () => {
  function fakeRows(경로: string[], 있는것: string[]) {
    return {
      from: () => ({
        select: () => ({
          eq: async () => ({ data: 경로.map((storage_path) => ({ storage_path })), error: null }),
        }),
      }),
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) =>
              있는것.includes(path)
                ? { path, signedUrl: `https://예시/${path}` }
                : { path: null, signedUrl: null },
            ),
            error: null,
          }),
        }),
      },
    } as unknown as SupabaseClient;
  }

  it("핀 판만 빠져도 챙길 대상이다", async () => {
    const a = "나/v1/a.webp";
    const b = "나/v1/b.webp";
    const supabase = fakeRows([a, b], [thumbPath(a), markerPath(a), thumbPath(b)]);

    expect(await missingThumbs(supabase, "나")).toEqual([b]);
  });
});

/*
  열어 둔 채 폰을 덮었다가 저녁에 다시 보면 사진이 다 깨져 있었다 —
  한 시간짜리 주소가 그새 죽은 것이다. 지도·목록·한장 요약가 모두
  이 세 길로 주소를 받으므로, 셋 다 하루짜리를 받는지 못 박아 둔다.
*/
describe("서명 주소의 수명", () => {
  function recording() {
    const asked: number[] = [];
    const client = {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[], seconds: number) => {
            asked.push(seconds);
            return { data: paths.map((path) => ({ path, signedUrl: `https://예시/${path}` })), error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
    return { client, asked };
  }

  it("하루", () => {
    expect(SIGNED_URL_SECONDS).toBe(86400);
  });

  it("목록 판·핀 판을 받을 때도 하루짜리를 받는다", async () => {
    const { client, asked } = recording();
    await thumbUrls(client, ["나/v1/a.webp"]);
    await markerUrls(client, ["나/v1/a.webp"]);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((seconds) => seconds === SIGNED_URL_SECONDS)).toBe(true);
  });
});

describe("reshrinkPhotos · 무거운 사진 다시 줄이기", () => {
  const bytes = (n: number, type = "image/webp") => new Blob([new Uint8Array(n)], { type });

  function fake(options: { failUploadOf?: string } = {}) {
    const state = { uploaded: [] as { path: string; type: string; upsert: boolean }[] };
    const supabase = {
      storage: {
        from: () => ({
          createSignedUrls: async (paths: string[]) => ({
            data: paths.map((path) => ({ path, signedUrl: `https://예시/${path}` })),
            error: null,
          }),
          upload: async (path: string, _blob: Blob, opts: { contentType: string; upsert: boolean }) => {
            if (path === options.failUploadOf) return { error: { message: "nope" } };
            state.uploaded.push({ path, type: opts.contentType, upsert: opts.upsert });
            return { error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
    vi.stubGlobal("fetch", async () => ({ ok: true, blob: async () => bytes(4000, "image/webp") }));
    return { supabase, state };
  }

  beforeEach(() => {
    reshrinkMock.mockReset();
    reshrinkMock.mockResolvedValue({
      full: bytes(400, "image/jpeg"),
      thumb: bytes(80, "image/jpeg"),
      marker: bytes(8, "image/jpeg"),
    });
  });

  it("세 판을 같은 이름에 덮어쓰고, 보관본은 맨 끝에 — 끊기면 다음에 다시 잡히게", async () => {
    const { supabase, state } = fake();
    const outcome = await reshrinkPhotos(supabase, [{ path: "나/v1/a.webp", bytes: 4600 }]);

    expect(state.uploaded.map((u) => u.path)).toEqual([markerPath("나/v1/a.webp"), thumbPath("나/v1/a.webp"), "나/v1/a.webp"]);
    expect(state.uploaded.every((u) => u.upsert && u.type === "image/jpeg")).toBe(true);
    expect(outcome).toEqual({ done: 1, failed: 0, skipped: 0, bytesBefore: 4600, bytesAfter: 488 });
  });

  it("다시 구운 것이 더 무거우면 건드리지 않는다", async () => {
    reshrinkMock.mockResolvedValue({ full: bytes(5000), thumb: bytes(80), marker: bytes(8) });
    const { supabase, state } = fake();
    const outcome = await reshrinkPhotos(supabase, [{ path: "나/v1/a.webp", bytes: 4600 }]);

    expect(state.uploaded).toEqual([]);
    expect(outcome.skipped).toBe(1);
  });

  it("한 장이 실패해도 나머지는 한다", async () => {
    const { supabase, state } = fake({ failUploadOf: "나/v1/b.webp" });
    const paths = ["a", "b", "c", "d", "e"].map((name) => ({ path: `나/v1/${name}.webp`, bytes: 4600 }));
    const outcome = await reshrinkPhotos(supabase, paths);

    expect(outcome.done).toBe(4);
    expect(outcome.failed).toBe(1);
    expect(state.uploaded.filter((u) => !u.path.includes(".t")).map((u) => u.path).sort()).toEqual(
      ["나/v1/a.webp", "나/v1/c.webp", "나/v1/d.webp", "나/v1/e.webp"],
    );
  });
});
