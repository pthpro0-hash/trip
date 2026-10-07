import type { InboxCard } from "@/lib/supabase/mailboxPublic";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";
import type { FootprintStep } from "./footprint";

/*
  책꽂이 — 부모님이 열어 본 책을 해마다 꽂아 두고, 작년 오늘을 꺼내 보이고, 그해 다녀온 곳을 지도에 찍는다.

  여기는 셈만 한다. 그리는 것은 components/mailbox/receive 가 한다. 안 열어 본 엽서는 책꽂이에 꽂지 않는다 —
  위의 '새 엽서'에 큰 카드로 있다가, 열어 보면 꽂힌다.
*/

/** 그 책의 해. 다녀온 날, 모르면 보낸 날. 둘 다 모르면 "". */
function yearOf(card: InboxCard): string {
  const year = card.startedOn.slice(0, 4) || card.sentAt.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "";
}

/** 책을 꽂을 때의 차례를 정하는 날. 다녀온 날, 모르면 보낸 날. */
const dateOf = (card: InboxCard): string => card.startedOn || card.sentAt;

export interface ShelfYear {
  /** "2026". 날짜를 모르는 책들은 "". */
  year: string;
  cards: InboxCard[];
}

/** 열어 본 책을 해마다 나눈다. 새 해가 위, 같은 해 안에서는 최근에 다녀온 책이 먼저, 날짜를 모르는 책은 맨 아래. */
export function shelfYears(cards: InboxCard[]): ShelfYear[] {
  const byYear = new Map<string, InboxCard[]>();
  for (const card of cards) {
    if (!card.opened) continue;
    const year = yearOf(card);
    byYear.set(year, [...(byYear.get(year) ?? []), card]);
  }
  return [...byYear.entries()]
    .map(([year, list]) => ({ year, cards: list.sort((a, b) => dateOf(b).localeCompare(dateOf(a))) }))
    .sort((a, b) => (a.year === "" ? 1 : b.year === "" ? -1 : b.year.localeCompare(a.year)));
}

export const yearTitle = (year: string, count: number): string => (year === "" ? `날짜 모름 · ${count}권` : `${year}년 · ${count}권`);

/* ── 작년 오늘 ─────────────────────────────────────────── */

/** 오늘 앞뒤로 이만큼(일) 안이면 '오늘 즈음'이다. */
const NEAR_DAYS = 3;
const DAY_MS = 86_400_000;

const parse = (iso: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
};
const utcDay = (year: number, month: number, day: number): number => Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);

export interface LastYearToday {
  card: InboxCard;
  /** 몇 해 전인가(1 이상). */
  yearsAgo: number;
}

export const lastYearLabel = (yearsAgo: number): string => (yearsAgo === 1 ? "작년 오늘" : `${yearsAgo}년 전 오늘`);

/**
 * 지난 해들 가운데 '오늘'에 가장 가까운 책 한 권. today 는 "2026-10-07"(이 폰의 오늘).
 *
 * 여행 기간(끝난 날을 모르면 시작한 날 하루)에서 앞뒤 3일 안이면 후보이고, 기간에 오늘이 들어 있으면 거리 0 이다.
 * 거리가 같으면 더 최근 해. 해를 넘긴 여행(12월 30일~1월 2일)도 맞추려고 시작한 해와 그다음 해 둘 다 본다.
 * 오늘을 모르면(서버가 그린 첫 그림) 없다.
 */
export function lastYearToday(cards: InboxCard[], today: string): LastYearToday | null {
  const now = parse(today);
  if (!now) return null;
  let best: { card: InboxCard; yearsAgo: number; distance: number } | null = null;

  for (const card of cards) {
    const start = parse(card.startedOn);
    if (!start) continue;
    const end = parse(card.endedOn) ?? start;
    const from = utcDay(start.year, start.month, start.day);
    const to = Math.max(from, utcDay(end.year, end.month, end.day));

    for (const year of [start.year, start.year + 1]) {
      const yearsAgo = now.year - year;
      if (yearsAgo < 1) continue;
      const target = utcDay(year, now.month, now.day);
      const distance = target < from ? from - target : target > to ? target - to : 0;
      if (distance > NEAR_DAYS) continue;
      if (!best || distance < best.distance || (distance === best.distance && yearsAgo < best.yearsAgo)) {
        best = { card, yearsAgo, distance };
      }
    }
  }
  return best ? { card: best.card, yearsAgo: best.yearsAgo } : null;
}

/* ── 올해 지도 ─────────────────────────────────────────── */

/** 곳의 대표 사진 키. 책마다 같은 파일 이름(a.webp)이 있어서 엽서 주소를 앞에 붙인다. */
const photoKey = (card: InboxCard, file: string): string => `${card.id}/${file}`;

/** 그해 책들에서 찍을 곳. 날짜순이고, 책 하나를 한 여행으로 센다. 달을 못 읽는 곳은 건너뛴다. */
export function yearSteps(cards: InboxCard[]): FootprintStep[] {
  const found: { key: string; step: FootprintStep }[] = [];
  for (const card of cards) {
    card.places.forEach((place, index) => {
      const month = Number(place.day.slice(5, 7));
      if (!(month >= 1 && month <= 12)) return;
      found.push({
        key: `${place.day}|${card.startedOn}|${card.id}|${String(index).padStart(4, "0")}`,
        step: {
          placeName: place.placeName,
          lat: place.lat,
          lng: place.lng,
          month,
          day: Number(place.day.slice(8, 10)) || null,
          // 눌러서 갈 곳은 없다(shared). 책마다 한 여행으로 세려고 엽서 주소를 넣는다.
          tripId: card.id,
          photoCount: place.photoCount,
          photoPath: place.photo ? photoKey(card, place.photo) : null,
        },
      });
    });
  }
  return found.sort((a, b) => a.key.localeCompare(b.key)).map((entry) => entry.step);
}

/** 곳의 대표 사진 키 → 공개 보관함 주소. */
export function yearPhotoUrls(cards: InboxCard[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const card of cards) {
    for (const place of card.places) {
      if (place.photo) urls.set(photoKey(card, place.photo), postcardFileUrl(card.id, place.photo));
    }
  }
  return urls;
}

export function yearTotals(cards: InboxCard[], steps: FootprintStep[]): { trips: number; places: number; photos: number } {
  return { trips: cards.length, places: steps.length, photos: cards.reduce((sum, card) => sum + card.photoCount, 0) };
}
