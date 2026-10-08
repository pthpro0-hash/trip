// @vitest-environment node
import { describe, it, expect } from "vitest";
import { coverPhotoOf } from "./tripCover";

/*
  여행 상세의 맨 위에 올릴 대표 사진. 저장할 때 첫 장을 대표로 세워 두고(isCover), 사진을 지워 대표가 사라지면
  남은 첫 장을 세운다 — 그래도 표시가 없는 여행(예전 기록, 대표만 지운 경우)이 있을 수 있으니 첫 사진으로 물러난다.
*/

const photo = (id: string, takenAt: string, isCover = false) => ({
  id,
  storagePath: `나/${id}.webp`,
  takenAt: new Date(takenAt),
  isCover,
});

const visit = (id: string, photos: ReturnType<typeof photo>[]) => ({ id, photos });

describe("coverPhotoOf", () => {
  it("대표로 표시된 사진이 먼저다 — 어느 방문에 있든", () => {
    const trip = {
      visits: [
        visit("v1", [photo("a", "2026-09-13T09:00"), photo("b", "2026-09-13T10:00")]),
        visit("v2", [photo("c", "2026-09-14T09:00", true)]),
      ],
    };
    expect(coverPhotoOf(trip)?.id).toBe("c");
  });

  it("대표 표시가 없으면 첫 방문의 첫 사진", () => {
    const trip = {
      visits: [visit("v1", [photo("a", "2026-09-13T09:00"), photo("b", "2026-09-13T10:00")]), visit("v2", [photo("c", "2026-09-14T09:00")])],
    };
    expect(coverPhotoOf(trip)?.id).toBe("a");
  });

  it("앞 방문에 사진이 없으면 사진이 있는 첫 방문에서", () => {
    const trip = { visits: [visit("v1", []), visit("v2", [photo("c", "2026-09-14T09:00")])] };
    expect(coverPhotoOf(trip)?.id).toBe("c");
  });

  it("대표 표시가 여럿이면 앞선 것", () => {
    const trip = { visits: [visit("v1", [photo("a", "2026-09-13T09:00", true)]), visit("v2", [photo("c", "2026-09-14T09:00", true)])] };
    expect(coverPhotoOf(trip)?.id).toBe("a");
  });

  it("사진이 하나도 없으면 null — 맨 위에 올릴 것이 없다", () => {
    expect(coverPhotoOf({ visits: [visit("v1", []), visit("v2", [])] })).toBeNull();
    expect(coverPhotoOf({ visits: [] })).toBeNull();
  });

  it("받은 여행을 건드리지 않는다", () => {
    const trip = { visits: [visit("v1", [photo("a", "2026-09-13T09:00"), photo("b", "2026-09-13T10:00", true)])] };
    const before = JSON.stringify(trip);
    coverPhotoOf(trip);
    expect(JSON.stringify(trip)).toBe(before);
  });
});
