// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Shot } from "./types";
import type { Shrunk } from "./resize";
import { UnsupportedImageError } from "./resize";

/*
  [로그인하고 기록하기]를 누르면, 로그인하러 떠나기 전에 올릴 크기로 사진을 줄여 이 브라우저에 맡겨 둔다(lib/photo/stash).
  여기서 보는 것은 그 준비 과정이다 — 한 장씩 줄여 맡기고, 줄이지 못한 사진은 이름만 적어 두고, 저장소가 막히면 맡은 것을 모두
  치우고 "못 했다"고 알려 부르는 쪽이 예전 길로 물러나게 한다.
*/

const shrink = vi.fn<(file: File) => Promise<Shrunk>>();
vi.mock("./resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./resize")>()),
  shrinkToWebp: (file: File) => shrink(file),
}));

/** 맡기는 쪽을 흉내 낸다 — 무엇을 맡았고 마쳤는지, 중간에 실패하는지. */
const stash = {
  room: true,
  begin: true,
  putFails: "" as string,
  puts: [] as string[],
  committed: null as null | { unsupported: string[]; titles: Record<string, string> },
  aborted: false,
};
vi.mock("./stash", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stash")>()),
  stashHasRoom: async () => stash.room,
  beginStash: async () =>
    stash.begin
      ? {
          put: async (id: string) => {
            if (id === stash.putFails) throw new Error("QuotaExceededError");
            stash.puts.push(id);
          },
          commit: async (meta: { unsupported: string[]; titles: Record<string, string> }) => {
            stash.committed = meta;
          },
          abort: async () => {
            stash.aborted = true;
          },
        }
      : null,
}));

const { canPrepare, prepareForLogin } = await import("./prepare");
const { STASH_MAX_PHOTOS } = await import("./stash");

const shot = (id: string): Shot => ({ id, takenAt: new Date("2026-09-13T09:00"), lat: 37.7, lng: 128.9 });
const files = (ids: string[]) => new Map(ids.map((id) => [id, new File(["x"], id, { type: "image/jpeg" })]));
const meta = { trips: [], titles: { "a.jpg": "강릉 바다" }, companions: {}, places: [] as [string, never][] };

beforeEach(() => {
  shrink.mockReset();
  shrink.mockImplementation(async (file) => ({ full: new Blob([file.name]), thumb: new Blob([file.name]), marker: new Blob([file.name]) }));
  Object.assign(stash, { room: true, begin: true, putFails: "", puts: [], committed: null, aborted: false });
});

describe("canPrepare · 맡아 둘 만한 양인가", () => {
  it("한 장 이상, 상한(500장) 이하일 때만 — 그보다 많으면 줄이는 데만 몇 분이 걸려 예전 길로 간다", () => {
    expect(canPrepare(0)).toBe(false);
    expect(canPrepare(1)).toBe(true);
    expect(canPrepare(STASH_MAX_PHOTOS)).toBe(true);
    expect(canPrepare(STASH_MAX_PHOTOS + 1)).toBe(false);
  });
});

describe("prepareForLogin", () => {
  it("한 장씩 줄여 맡기고, 여행 정보를 적어 마친다", async () => {
    const ok = await prepareForLogin({ shots: ["a.jpg", "b.jpg", "c.jpg"].map(shot), files: files(["a.jpg", "b.jpg", "c.jpg"]), meta });
    expect(ok).toBe(true);
    expect(stash.puts).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(stash.committed).toMatchObject({ unsupported: [], titles: { "a.jpg": "강릉 바다" } });
    expect(stash.aborted).toBe(false);
  });

  it("줄이기는 한 장씩 한다 — 펼친 그림이 둘 이상 살아 있지 않게", async () => {
    let shrinking = 0;
    let peak = 0;
    shrink.mockImplementation(async (file) => {
      shrinking += 1;
      peak = Math.max(peak, shrinking);
      await new Promise((resolve) => setTimeout(resolve, 0));
      shrinking -= 1;
      return { full: new Blob([file.name]), thumb: new Blob([file.name]), marker: new Blob([file.name]) };
    });
    const ids = Array.from({ length: 8 }, (_, i) => `${i}.jpg`);
    await prepareForLogin({ shots: ids.map(shot), files: files(ids), meta });
    expect(peak).toBe(1);
  });

  it("줄이지 못한 사진(아이폰 HEIC 등)은 이름만 적어 두고 나머지는 이어서 맡는다", async () => {
    shrink.mockImplementation(async (file) => {
      if (file.name === "b.heic") throw new UnsupportedImageError(file.name);
      return { full: new Blob([file.name]), thumb: new Blob([file.name]), marker: new Blob([file.name]) };
    });
    const ids = ["a.jpg", "b.heic", "c.jpg"];
    const ok = await prepareForLogin({ shots: ids.map(shot), files: files(ids), meta });
    expect(ok).toBe(true);
    expect(stash.puts).toEqual(["a.jpg", "c.jpg"]);
    expect(stash.committed!.unsupported).toEqual(["b.heic"]);
  });

  it("그 밖의 이유로 줄이지 못한 사진도 같게 다룬다 — 한 장 때문에 전부를 못 맡지 않는다", async () => {
    shrink.mockImplementation(async (file) => {
      if (file.name === "b.jpg") throw new Error("디코딩 실패");
      return { full: new Blob([file.name]), thumb: new Blob([file.name]), marker: new Blob([file.name]) };
    });
    const ids = ["a.jpg", "b.jpg"];
    expect(await prepareForLogin({ shots: ids.map(shot), files: files(ids), meta })).toBe(true);
    expect(stash.committed!.unsupported).toEqual(["b.jpg"]);
  });

  it("고른 파일이 없는 사진은 올릴 수 없다 — 이름만 적어 둔다", async () => {
    const ok = await prepareForLogin({ shots: ["a.jpg", "gone.jpg"].map(shot), files: files(["a.jpg"]), meta });
    expect(ok).toBe(true);
    expect(stash.committed!.unsupported).toEqual(["gone.jpg"]);
  });

  it("몇 장째인지 알린다 — 줄이지 못한 장도 센다, 뒤로 가지 않는다", async () => {
    shrink.mockImplementation(async (file) => {
      if (file.name === "b.jpg") throw new UnsupportedImageError(file.name);
      return { full: new Blob([file.name]), thumb: new Blob([file.name]), marker: new Blob([file.name]) };
    });
    const seen: number[] = [];
    const ids = ["a.jpg", "b.jpg", "c.jpg"];
    await prepareForLogin({ shots: ids.map(shot), files: files(ids), meta, onProgress: (done, total) => seen.push(done * 10 + total) });
    expect(seen).toEqual([3, 13, 23, 33]);
  });

  describe("못 맡을 때는 못 했다고 알린다 — 부르는 쪽이 예전 길로 물러난다", () => {
    it("공간이 모자라면 시작도 하지 않는다", async () => {
      stash.room = false;
      expect(await prepareForLogin({ shots: [shot("a.jpg")], files: files(["a.jpg"]), meta })).toBe(false);
      expect(shrink).not.toHaveBeenCalled();
      expect(stash.puts).toEqual([]);
    });

    it("저장소를 열지 못하면(사생활 보호 모드 등) 줄이기도 시작하지 않는다", async () => {
      stash.begin = false;
      expect(await prepareForLogin({ shots: [shot("a.jpg")], files: files(["a.jpg"]), meta })).toBe(false);
      expect(shrink).not.toHaveBeenCalled();
    });

    it("맡다가 저장소가 막히면 맡은 것을 모두 치우고 못 했다고 한다", async () => {
      stash.putFails = "b.jpg";
      const ids = ["a.jpg", "b.jpg", "c.jpg"];
      expect(await prepareForLogin({ shots: ids.map(shot), files: files(ids), meta })).toBe(false);
      expect(stash.aborted).toBe(true);
      expect(stash.committed).toBeNull();
      // 막힌 뒤로는 더 줄이지 않는다.
      expect(shrink).toHaveBeenCalledTimes(2);
    });

    it("사진이 하나도 없으면 맡을 것이 없다", async () => {
      expect(await prepareForLogin({ shots: [], files: new Map(), meta })).toBe(false);
    });
  });
});
