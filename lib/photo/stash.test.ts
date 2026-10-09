// @vitest-environment node
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STASH_BYTES_PER_PHOTO,
  STASH_TTL_MS,
  beginStash,
  clearStash,
  loadStashedPhoto,
  probeStash,
  readStash,
  stashHasRoom,
  stashSupported,
  type StashMeta,
} from "./stash";
import type { Shrunk } from "./resize";

/*
  로그인하러 떠나기 전에, 올릴 크기로 줄인 사진과 찾은 여행을 이 브라우저 저장소(IndexedDB)에 잠깐 맡겨 둔다. 로그인하고 돌아오면
  꺼내 그 자리에서 이어 기록한다. 서버로는 아무것도 가지 않는다.

  저장소는 못 쓰는 때가 있다(사생활 보호 모드 · 공간 부족). 그때는 어떤 함수도 던지지 않고 "못 했다"만 돌려줘야 부르는 쪽이
  예전 길(같은 사진을 한 번 더)로 물러날 수 있다.
*/

const bytes = (text: string) => new TextEncoder().encode(text);
const shrunk = (name: string): Shrunk => ({
  full: new Blob([bytes(`full:${name}`)], { type: "image/webp" }),
  thumb: new Blob([bytes(`thumb:${name}`)], { type: "image/webp" }),
  // 아이폰 사파리는 WebP 를 못 구워 JPEG 로 굽는다 — 형식도 그대로 돌아와야 한다.
  marker: new Blob([bytes(`marker:${name}`)], { type: "image/jpeg" }),
});

const meta = (over: Partial<Omit<StashMeta, "v" | "savedAt" | "photoIds">> = {}) => ({
  trips: [{ shots: [{ id: "a.jpg", takenAt: 1_790_000_000_000, lat: 37.7, lng: 128.9 }], visits: [["a.jpg"]] }],
  titles: { "a.jpg": "강릉 바다" },
  companions: { "a.jpg": "가족" },
  places: [["37.700,128.900", { title: "안목해변", isCuratedSpot: false, spotId: null, dong: "강릉시 송정동" }]] as StashMeta["places"],
  unsupported: [] as string[],
  ...over,
});

const text = async (blob: Blob) => new TextDecoder().decode(await blob.arrayBuffer());

async function reset() {
  await clearStash();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("trip-stash");
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

beforeEach(reset);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("stashSupported · probeStash", () => {
  it("저장소가 있으면 지원하고, 실제로 쓸 수 있는지도 본다", async () => {
    expect(stashSupported()).toBe(true);
    expect(await probeStash()).toBe(true);
  });

  it("저장소가 없는 브라우저에서는 둘 다 아니다 — 던지지 않는다", async () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(stashSupported()).toBe(false);
    expect(await probeStash()).toBe(false);
  });

  it("열려다 거절당하는 곳(사생활 보호 모드 등)에서도 던지지 않고 false", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("접근 거부");
      },
    });
    expect(await probeStash()).toBe(false);
    expect(await beginStash()).toBeNull();
    expect(await readStash()).toBeNull();
    await expect(clearStash()).resolves.toBeUndefined();
  });

  it("써 본 흔적을 남기지 않는다", async () => {
    await probeStash();
    expect(await readStash()).toBeNull();
  });
});

describe("맡기고 꺼내기", () => {
  it("맡긴 여행과 사진을 그대로 꺼낸다 — 형식(webp/jpeg)까지", async () => {
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    await writer.put("b.jpg", shrunk("b"));
    await writer.commit(meta());

    const stored = (await readStash())!;
    expect(stored.v).toBe(1);
    expect(stored.photoIds).toEqual(["a.jpg", "b.jpg"]);
    expect(stored.trips).toEqual(meta().trips);
    expect(stored.titles).toEqual({ "a.jpg": "강릉 바다" });
    expect(stored.companions).toEqual({ "a.jpg": "가족" });
    expect(stored.places).toEqual(meta().places);

    const photo = (await loadStashedPhoto("b.jpg"))!;
    expect(await text(photo.full)).toBe("full:b");
    expect(await text(photo.thumb)).toBe("thumb:b");
    expect(await text(photo.marker)).toBe("marker:b");
    expect([photo.full.type, photo.thumb.type, photo.marker.type]).toEqual(["image/webp", "image/webp", "image/jpeg"]);
  });

  it("줄이지 못한 사진의 이름(HEIC 등)도 함께 맡는다", async () => {
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    await writer.commit(meta({ unsupported: ["IMG_0001.HEIC"] }));
    expect((await readStash())!.unsupported).toEqual(["IMG_0001.HEIC"]);
  });

  it("없는 사진은 null", async () => {
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    await writer.commit(meta());
    expect(await loadStashedPhoto("nope.jpg")).toBeNull();
  });

  it("아무것도 맡기지 않았으면 읽을 것이 없다", async () => {
    expect(await readStash()).toBeNull();
    expect(await loadStashedPhoto("a.jpg")).toBeNull();
  });

  // 사진을 몇 장 맡다가 끊기면(앱을 닫음 · 공간 부족) 여행 정보가 없는 조각만 남는다 — 그것을 '맡겨 둔 것'으로 읽으면 안 된다.
  it("맡기다 만 것(여행 정보를 적기 전)은 맡겨 둔 것이 아니다", async () => {
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    expect(await readStash()).toBeNull();
    await writer.abort();
  });

  it("새로 맡기면 이전에 맡긴 것은 지워진다 — 한 번에 한 벌", async () => {
    const first = (await beginStash())!;
    await first.put("old.jpg", shrunk("old"));
    await first.commit(meta({ titles: { "old.jpg": "옛 여행" } }));

    const second = (await beginStash())!;
    expect(await readStash()).toBeNull();
    expect(await loadStashedPhoto("old.jpg")).toBeNull();
    await second.put("new.jpg", shrunk("new"));
    await second.commit(meta({ titles: { "new.jpg": "새 여행" } }));
    expect((await readStash())!.photoIds).toEqual(["new.jpg"]);
  });

  it("맡기다 그만두면(abort) 사진도 여행 정보도 남지 않는다", async () => {
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    await writer.abort();
    expect(await readStash()).toBeNull();
    expect(await loadStashedPhoto("a.jpg")).toBeNull();
  });

  it("clearStash 는 모두 지운다", async () => {
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    await writer.commit(meta());
    await clearStash();
    expect(await readStash()).toBeNull();
    expect(await loadStashedPhoto("a.jpg")).toBeNull();
  });
});

describe("맡겨 둔 지 오래되면 — 공용 기기에 사진 조각이 남지 않게", () => {
  const commitAt = async (now: number) => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(now);
    const writer = (await beginStash())!;
    await writer.put("a.jpg", shrunk("a"));
    await writer.commit(meta());
    spy.mockRestore();
  };

  it("하루 안에는 그대로 있다", async () => {
    const start = 1_790_000_000_000;
    await commitAt(start);
    vi.spyOn(Date, "now").mockReturnValue(start + STASH_TTL_MS - 1000);
    expect(await readStash()).not.toBeNull();
  });

  it("하루가 지나면 읽는 순간 비워 버린다 — 사진까지", async () => {
    const start = 1_790_000_000_000;
    await commitAt(start);
    vi.spyOn(Date, "now").mockReturnValue(start + STASH_TTL_MS + 1000);
    expect(await readStash()).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(start);
    expect(await loadStashedPhoto("a.jpg")).toBeNull();
  });
});

describe("stashHasRoom · 공간이 넉넉한가", () => {
  const withQuota = (quota: number, usage: number) =>
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({ quota, usage }) } });
  const MB = 1024 * 1024;

  it("남은 공간이 사진들이 차지할 만큼(넉넉히) 되면 true", async () => {
    withQuota(100 * MB, 90 * MB); // 10MB 남음
    expect(await stashHasRoom(5)).toBe(true); // 5장 ≈ 4MB × 1.25
  });

  it("모자라면 false — 쓰다 실패하기 전에 미리 물러난다", async () => {
    withQuota(100 * MB, 90 * MB);
    expect(await stashHasRoom(20)).toBe(false); // 20장 ≈ 16MB × 1.25
  });

  it("공간을 알려 주지 않는 브라우저는 막지 않는다 — 쓰다 실패하면 그때 물러난다", async () => {
    vi.stubGlobal("navigator", {});
    expect(await stashHasRoom(500)).toBe(true);
    vi.stubGlobal("navigator", { storage: { estimate: async () => ({}) } });
    expect(await stashHasRoom(500)).toBe(true);
  });

  it("알려 주다 실패해도 던지지 않는다", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: async () => {
          throw new Error("x");
        },
      },
    });
    expect(await stashHasRoom(10)).toBe(true);
  });

  it("사진 한 장의 몫은 보관본·목록 판·핀을 합친 크기에 맞춰 넉넉하다", () => {
    // 보관본 ≤600KB + 목록 판 ≤150KB + 핀 수 KB.
    expect(STASH_BYTES_PER_PHOTO).toBeGreaterThanOrEqual(750 * 1024);
  });
});
