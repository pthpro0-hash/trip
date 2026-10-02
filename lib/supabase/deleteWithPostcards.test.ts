// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const log: string[] = [];
const cleanup = vi.hoisted(() => ({
  removeCopiesOfTrip: vi.fn(async () => true),
  removeCopiesOfPhoto: vi.fn(async () => true),
}));
vi.mock("./postcardCleanup", () => ({
  POSTCARD_BUCKET: "postcards",
  sweepPostcardFolder: vi.fn(),
  withdrawPostcard: vi.fn(),
  ...cleanup,
}));
vi.mock("./tripShares", () => ({
  fetchOwnTripShare: vi.fn(async () => null),
  revokeTripShare: vi.fn(async () => true),
}));

const { deleteTrip } = await import("./trips");
const { deletePhoto } = await import("./photos");

/*
  원본을 지우면 엽서 복사본도 지운다. 복사본을 먼저 치우고(줄이 먼저 사라지면 공개 보관함의 사진이
  주인 없이 남는다), 못 치웠으면 원본도 지우지 않는다.
*/

function fake() {
  const supabase = {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }),
      delete: () => ({
        eq: () => ({
          eq: async () => {
            log.push(`delete ${table}`);
            return { error: null };
          },
        }),
      }),
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
    storage: {
      from: () => ({
        remove: async () => {
          log.push("remove-files");
          return { data: [], error: null };
        },
      }),
    },
  };
  return supabase as unknown as SupabaseClient;
}

beforeEach(() => {
  log.length = 0;
  cleanup.removeCopiesOfTrip.mockReset();
  cleanup.removeCopiesOfPhoto.mockReset();
  cleanup.removeCopiesOfTrip.mockImplementation(async () => {
    log.push("copies-of-trip");
    return true;
  });
  cleanup.removeCopiesOfPhoto.mockImplementation(async () => {
    log.push("copies-of-photo");
    return true;
  });
});

describe("deleteTrip · 보낸 엽서가 있는 여행", () => {
  it("엽서 사진 복사본부터 치우고, 그다음 여행을 지운다", async () => {
    expect(await deleteTrip(fake(), "u", "t1")).toBe(true);
    expect(cleanup.removeCopiesOfTrip).toHaveBeenCalledWith(expect.anything(), "t1");
    expect(log.indexOf("copies-of-trip")).toBeLessThan(log.indexOf("delete trips"));
  });

  it("복사본을 못 치웠으면 여행도 지우지 않는다", async () => {
    cleanup.removeCopiesOfTrip.mockResolvedValue(false);
    expect(await deleteTrip(fake(), "u", "t1")).toBe(false);
    expect(log).not.toContain("delete trips");
    expect(log).not.toContain("remove-files");
  });
});

describe("deletePhoto · 엽서에 쓴 사진", () => {
  const photo = { id: "p1", storagePath: "u/v1/a.webp", visitId: "v1" };

  it("그 사진에서 나온 복사본부터 치우고, 그다음 사진을 지운다", async () => {
    expect(await deletePhoto(fake(), "u", photo)).toBe(true);
    expect(cleanup.removeCopiesOfPhoto).toHaveBeenCalledWith(expect.anything(), "p1");
    expect(log.indexOf("copies-of-photo")).toBeLessThan(log.indexOf("delete trip_photos"));
  });

  it("복사본을 못 치웠으면 사진도 지우지 않는다", async () => {
    cleanup.removeCopiesOfPhoto.mockResolvedValue(false);
    expect(await deletePhoto(fake(), "u", photo)).toBe(false);
    expect(log).not.toContain("delete trip_photos");
    expect(log).not.toContain("remove-files");
  });
});
