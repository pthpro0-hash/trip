// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addToExistingTrip } from "./tripAdd";
import type { Shot, Visit } from "@/lib/photo/types";

/* 같은 날짜의 여행이 이미 있을 때 새 여행을 또 만들지 않고 거기에 새 사진만 더한다. 메모리에 표를 두고 요청을 흉내 낸다. */
type Row = Record<string, unknown>;
type Db = { trips: Row[]; visits: Row[]; trip_photos: Row[] };

function fake(db: Db, fail?: string) {
  let nextId = 1;
  const from = (table: keyof Db) => {
    const rows = db[table];
    let action: "select" | "update" | "insert" = "select";
    let patch: Row = {};
    let wantOne = false;
    let inserted: Row | null = null;
    const filters: ((row: Row) => boolean)[] = [];
    let window: [number, number] | null = null;
    let limit = Infinity;
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), api),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), api),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
      order: () => api,
      limit: (n: number) => ((limit = n), api),
      range: (a: number, b: number) => ((window = [a, b]), api),
      update: (p: Row) => ((action = "update"), (patch = p), api),
      insert: (r: Row) => {
        action = "insert";
        inserted = { id: `new${nextId++}`, ...r };
        rows.push(inserted);
        return api;
      },
      single: () => ((wantOne = true), api),
      then: (resolve: (v: unknown) => void) => {
        if (fail === table) return resolve({ data: null, error: { message: "boom" } });
        if (action === "insert") return resolve({ data: wantOne ? inserted : [inserted], error: null });
        let hit = rows.filter((r) => filters.every((f) => f(r)));
        if (action === "update") {
          for (const r of hit) Object.assign(r, patch);
          return resolve({ data: null, error: null });
        }
        if (window) hit = hit.slice(window[0], window[1] + 1);
        resolve({ data: hit.slice(0, limit), error: null });
      },
    };
    return api;
  };
  return { from } as unknown as SupabaseClient;
}

const shot = (id: string, at: string, lat = 37.7728, lng = 128.9474): Shot => ({ id, takenAt: new Date(at), lat, lng });
const visit = (...shots: Shot[]): Visit => ({ shots });
const place = { title: "새 곳", spotId: null, dong: null };
const range = { start: "2026-09-13", end: "2026-09-14" };

function base(): Db {
  return {
    trips: [{ id: "t1", user_id: "u", started_on: "2026-09-13", ended_on: "2026-09-14" }],
    visits: [
      { id: "v1", trip_id: "t1", position: 0, lat: 37.7728, lng: 128.9474, started_at: "2026-09-14T06:11:00", ended_at: "2026-09-14T08:41:00", photo_count: 2 },
    ],
    trip_photos: [
      { visit_id: "v1", taken_at: "2026-09-14T06:11:00", lat: 37.7728, lng: 128.9474 },
      { visit_id: "v1", taken_at: "2026-09-14T08:41:00", lat: 37.7728, lng: 128.9474 },
    ],
  };
}

describe("addToExistingTrip", () => {
  it("겹치는 여행이 없으면 찾지 못했다고 한다 — 아무것도 만들지 않는다", async () => {
    const db = { ...base(), trips: [] };
    const result = await addToExistingTrip(fake(db), "u", [visit(shot("a", "2026-09-14T09:00"))], [place], range);
    expect(result).toMatchObject({ ok: true, found: false, parts: [] });
    expect(db.visits).toHaveLength(1);
  });

  it("이미 있는 사진은 건너뛴다 — 같은 사진을 두 번 넣어도 늘지 않는다", async () => {
    const db = base();
    const result = await addToExistingTrip(
      fake(db), "u",
      [visit(shot("a", "2026-09-14T06:11"), shot("b", "2026-09-14T08:41"))], [place], range,
    );
    expect(result).toMatchObject({ ok: true, found: true, parts: [], duplicates: 2 });
    expect(db.visits[0].photo_count).toBe(2);
  });

  it("가까운 같은 날 방문이 있으면 거기에 붙이고, 개수와 시각을 늘린다", async () => {
    const db = base();
    const result = await addToExistingTrip(
      fake(db), "u",
      [visit(shot("a", "2026-09-14T06:11"), shot("n1", "2026-09-14T09:30"), shot("n2", "2026-09-14T09:40"))], [place], range,
    );
    expect(result.parts).toEqual([{ visitId: "v1", shots: [expect.objectContaining({ id: "n1" }), expect.objectContaining({ id: "n2" })] }]);
    expect(result.duplicates).toBe(1);
    expect(db.visits).toHaveLength(1);
    expect(db.visits[0]).toMatchObject({ photo_count: 4, ended_at: "2026-09-14 09:40:00", started_at: "2026-09-14 06:11:00" });
  });

  it("멀리 떨어진 곳이면 새 방문으로 뒤에 붙이고, 사진은 그 방문에", async () => {
    const db = base();
    const result = await addToExistingTrip(fake(db), "u", [visit(shot("s", "2026-09-14T10:02", 37.7863, 128.9303))], [{ title: "송정해변", spotId: null, dong: "송정동" }], range);
    expect(db.visits).toHaveLength(2);
    expect(db.visits[1]).toMatchObject({ trip_id: "t1", position: 1, place_name: "송정해변", photo_count: 1 });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].visitId).toBe(db.visits[1].id);
  });

  it("다른 날 사진은 같은 자리여도 새 방문이고, 여행 기간을 넓힌다", async () => {
    const db = base();
    await addToExistingTrip(fake(db), "u", [visit(shot("x", "2026-09-15T09:00"))], [place], { start: "2026-09-14", end: "2026-09-15" });
    expect(db.visits).toHaveLength(2);
    expect(db.trips[0]).toMatchObject({ started_on: "2026-09-13", ended_on: "2026-09-15" });
  });

  it("기간 안의 사진이면 기간은 그대로", async () => {
    const db = base();
    await addToExistingTrip(fake(db), "u", [visit(shot("x", "2026-09-13T09:00", 38.4, 128.4))], [place], range);
    expect(db.trips[0]).toMatchObject({ started_on: "2026-09-13", ended_on: "2026-09-14" });
  });

  it("읽거나 쓰다 막히면 못 했다고 한다 — 던지지 않는다", async () => {
    for (const table of ["trips", "visits", "trip_photos"]) {
      const result = await addToExistingTrip(fake(base(), table), "u", [visit(shot("n", "2026-09-14T09:00"))], [place], range);
      expect(result.ok, table).toBe(false);
    }
  });
});
