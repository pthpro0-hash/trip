import type { SupabaseClient } from "@supabase/supabase-js";
import { dayKey } from "@/lib/photo/grouping";
import type { Shot, Visit } from "@/lib/photo/types";
import type { DateRange, VisitPlace } from "./trips";

/*
  이미 기록한 여행에 사진을 더한다.

  같은 날짜의 여행이 이미 있을 때 새 여행을 또 만들면 같은 여행이 두 건이 되고, 아예 막으면 뒤늦게 찾은 사진을 넣을 길이 없다.
  그래서 겹치는 기존 여행을 찾아 거기에 더한다:
    - 이미 있는 사진(같은 촬영 시각 · 같은 자리)은 건너뛴다 — 같은 사진을 두 번 넣어도 늘어나지 않는다(다시 해 보기도 안전하다).
    - 새 사진은 가까운 곳(500m · 같은 날)에 이미 있는 방문이 있으면 거기에, 아니면 새 방문으로 붙인다.
    - 여행의 기간은 새 사진이 넓히면 넓힌다.
  사진 파일을 올리는 일은 부르는 쪽이 한다(어느 방문에 어느 사진인지만 돌려준다).
*/

const NEAR_KM = 0.5;
const PAGE = 1000;

export interface AddPart {
  visitId: string;
  /** 이 방문에 새로 붙을 사진(이미 있던 것은 뺀 것). */
  shots: Shot[];
}

export interface AddResult {
  ok: boolean;
  /** 겹치는 기존 여행을 찾았는가. */
  found: boolean;
  parts: AddPart[];
  /** 이미 있어서 건너뛴 사진 수. */
  duplicates: number;
}

const pad = (value: number) => String(value).padStart(2, "0");
const wall = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
/** 표에서 읽은 시각("2026-09-13T09:21:00")을 같은 모양으로. */
const stamp = (value: string) => value.replace("T", " ").slice(0, 19);
const spot = (lat: number | null, lng: number | null) => `${lat == null ? "" : lat.toFixed(4)},${lng == null ? "" : lng.toFixed(4)}`;

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (degree: number) => (degree * Math.PI) / 180;
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

interface ExistingVisit {
  id: string;
  position: number;
  lat: number;
  lng: number;
  started_at: string;
  ended_at: string;
  photo_count: number;
}

export async function addToExistingTrip(
  supabase: SupabaseClient,
  userId: string,
  visits: Visit[],
  places: VisitPlace[],
  range: DateRange,
): Promise<AddResult> {
  const fail: AddResult = { ok: false, found: false, parts: [], duplicates: 0 };
  try {
    const trips = await supabase
      .from("trips")
      .select("id,started_on,ended_on")
      .eq("user_id", userId)
      .lte("started_on", range.end)
      .gte("ended_on", range.start)
      .order("started_on", { ascending: true })
      .limit(1);
    if (trips.error) return fail;
    const trip = trips.data?.[0] as { id: string; started_on: string; ended_on: string } | undefined;
    if (!trip) return { ...fail, ok: true };

    const existingVisits = await supabase
      .from("visits")
      .select("id,position,lat,lng,started_at,ended_at,photo_count")
      .eq("trip_id", trip.id);
    if (existingVisits.error) return fail;
    const have = (existingVisits.data ?? []) as ExistingVisit[];

    // 이미 있는 사진의 열쇠(시각+자리). 천 장씩 나눠 읽는다.
    const seen = new Set<string>();
    if (have.length > 0) {
      for (let from = 0; ; from += PAGE) {
        const page = await supabase
          .from("trip_photos")
          .select("taken_at,lat,lng")
          .in("visit_id", have.map((visit) => visit.id))
          .range(from, from + PAGE - 1);
        if (page.error) return fail;
        const rows = (page.data ?? []) as { taken_at: string; lat: number | null; lng: number | null }[];
        for (const row of rows) seen.add(`${stamp(row.taken_at)}|${spot(row.lat, row.lng)}`);
        if (rows.length < PAGE) break;
      }
    }

    let duplicates = 0;
    let nextPosition = have.reduce((max, visit) => Math.max(max, visit.position), -1) + 1;
    const parts: AddPart[] = [];
    const added: Shot[] = [];

    for (const [index, visit] of visits.entries()) {
      const fresh = visit.shots.filter((shot) => {
        const key = `${wall(shot.takenAt)}|${spot(shot.lat, shot.lng)}`;
        if (seen.has(key)) {
          duplicates += 1;
          return false;
        }
        seen.add(key);
        return true;
      });
      if (fresh.length === 0) continue;

      const first = fresh[0];
      const last = fresh[fresh.length - 1];
      const day = dayKey(first.takenAt);
      let near: ExistingVisit | undefined;
      let best = NEAR_KM;
      for (const candidate of have) {
        if (!stamp(candidate.started_at).startsWith(day)) continue;
        const distance = km(candidate.lat, candidate.lng, first.lat, first.lng);
        if (distance <= best) {
          best = distance;
          near = candidate;
        }
      }

      if (near) {
        const startedAt = wall(first.takenAt) < stamp(near.started_at) ? wall(first.takenAt) : stamp(near.started_at);
        const endedAt = wall(last.takenAt) > stamp(near.ended_at) ? wall(last.takenAt) : stamp(near.ended_at);
        const count = near.photo_count + fresh.length;
        const updated = await supabase
          .from("visits")
          .update({ started_at: startedAt, ended_at: endedAt, photo_count: count })
          .eq("id", near.id);
        if (updated.error) return fail;
        near.started_at = startedAt;
        near.ended_at = endedAt;
        near.photo_count = count;
        parts.push({ visitId: near.id, shots: fresh });
      } else {
        const place = places[index];
        const inserted = await supabase
          .from("visits")
          .insert({
            trip_id: trip.id,
            user_id: userId,
            position: nextPosition++,
            place_name: place?.title ?? "알 수 없는 곳",
            spot_id: place?.spotId ?? null,
            lat: first.lat,
            lng: first.lng,
            dong: place?.dong ?? null,
            started_at: wall(first.takenAt),
            ended_at: wall(last.takenAt),
            photo_count: fresh.length,
          })
          .select("id")
          .single();
        if (inserted.error || !inserted.data) return fail;
        const created: ExistingVisit = {
          id: inserted.data.id as string,
          position: nextPosition - 1,
          lat: first.lat,
          lng: first.lng,
          started_at: wall(first.takenAt),
          ended_at: wall(last.takenAt),
          photo_count: fresh.length,
        };
        have.push(created);
        parts.push({ visitId: created.id, shots: fresh });
      }
      added.push(...fresh);
    }

    // 새 방문이 맨 뒤에 붙었으니 시각 순서로 번호를 다시 매긴다(바뀐 것만 고친다).
    if (added.length > 0) {
      const ordered = [...have].sort((x, y) => stamp(x.started_at).localeCompare(stamp(y.started_at)));
      for (const [position, visit] of ordered.entries()) {
        if (visit.position === position) continue;
        const moved = await supabase.from("visits").update({ position }).eq("id", visit.id);
        if (moved.error) return fail;
        visit.position = position;
      }
    }

    // 여행의 기간은 새 사진이 넓힐 때만 넓힌다.
    if (added.length > 0) {
      const days = added.map((shot) => dayKey(shot.takenAt)).sort();
      const startedOn = days[0] < trip.started_on ? days[0] : trip.started_on;
      const endedOn = days[days.length - 1] > trip.ended_on ? days[days.length - 1] : trip.ended_on;
      if (startedOn !== trip.started_on || endedOn !== trip.ended_on) {
        const widened = await supabase.from("trips").update({ started_on: startedOn, ended_on: endedOn }).eq("id", trip.id);
        if (widened.error) return fail;
      }
    }

    return { ok: true, found: true, parts, duplicates };
  } catch {
    return fail;
  }
}
