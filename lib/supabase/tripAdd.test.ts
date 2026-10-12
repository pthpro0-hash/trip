// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addToExistingTrip, recountVisits } from "./tripAdd";
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
    let head = false;
    let ordered = false;
    const api: Record<string, unknown> = {
      select: (_c?: string, opts?: { head?: boolean }) => ((head = Boolean(opts?.head)), api),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
      lte: (c: string, v: string) => (filters.push((r) => String(r[c]) <= v), api),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), api),
      in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), api),
      order: () => ((ordered = true), api),
      limit: (n: number) => ((limit = n), api),
      range: (a: number, b: number) => {
        // 정렬 없이 나눠 읽으면 서버는 순서를 보장하지 않는다 — 시험에서도 막는다.
        if (!ordered) throw new Error("range without order");
        window = [a, b];
        return api;
      },
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
          return resolve({ data: hit, error: null });
        }
        if (head) return resolve({ count: hit.length, error: null });
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
    // 사진 수는 올린 뒤 recountVisits 가 맞춘다 — 여기서는 시각만 늘린다.
    expect(db.visits[0]).toMatchObject({ photo_count: 2, ended_at: "2026-09-14 09:40:00", started_at: "2026-09-14 06:11:00" });
  });

  it("연사처럼 같은 시각·같은 자리의 사진이 여럿이면 이미 있는 장수만큼만 건너뛴다", async () => {
    const db = base();
    // 기존에 06:11 에 한 장 있다. 새로 같은 시각·자리 두 장이 오면 한 장만 이미 있던 것이다.
    const result = await addToExistingTrip(fake(db), "u", [visit(shot("a1", "2026-09-14T06:11"), shot("a2", "2026-09-14T06:11"))], [place], range);
    expect(result.duplicates).toBe(1);
    expect(result.parts[0].shots.map((s) => s.id)).toEqual(["a2"]);
  });

  it("권한 때문에 방문이 한 줄도 안 바뀌면 조용히 넘어가지 않고 못 했다고 한다", async () => {
    const db = base();
    const client = fake(db);
    const wrapped = { from: (table: string) => (table === "visits" ? { ...(client.from(table) as object), update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }) } : client.from(table)) } as unknown as SupabaseClient;
    const result = await addToExistingTrip(wrapped, "u", [visit(shot("n1", "2026-09-14T09:30"))], [place], range);
    expect(result.ok).toBe(false);
  });

  it("멀리 떨어진 곳이면 새 방문으로 뒤에 붙이고, 사진은 그 방문에", async () => {
    const db = base();
    const result = await addToExistingTrip(fake(db), "u", [visit(shot("s", "2026-09-14T10:02", 37.7863, 128.9303))], [{ title: "송정해변", spotId: null, dong: "송정동" }], range);
    expect(db.visits).toHaveLength(2);
    expect(db.visits[1]).toMatchObject({ trip_id: "t1", position: 1, place_name: "송정해변", photo_count: 0 });
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].visitId).toBe(db.visits[1].id);
  });

  it("새 방문이 시각 순서 가운데 끼면 번호를 시각 순서로 다시 매긴다", async () => {
    const db = base();
    // 기존 방문(14일 06:11~08:41)보다 앞선 13일의 먼 곳.
    await addToExistingTrip(fake(db), "u", [visit(shot("early", "2026-09-13T09:00", 38.4, 128.4))], [place], range);
    const byPosition = [...db.visits].sort((x, y) => Number(x.position) - Number(y.position)).map((v) => v.id);
    expect(byPosition).toEqual([db.visits[1].id, "v1"]);
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

describe("recountVisits · 올린 뒤 사진 수 맞추기", () => {
  it("방문의 사진 수를 실제 사진 줄 수로 맞춘다 — 올리다 막혔어도 어긋나지 않는다", async () => {
    const db = base();
    db.visits[0].photo_count = 99;
    await recountVisits(fake(db), ["v1", "v1"]);
    expect(db.visits[0].photo_count).toBe(2);
  });

  it("세다 막혀도 던지지 않는다", async () => {
    await expect(recountVisits(fake(base(), "trip_photos"), ["v1"])).resolves.toBeUndefined();
  });
});
