import type { InboxCard } from "@/lib/supabase/mailboxPublic";
import { shelfYears, yearSteps } from "./mailboxShelf";

/*
  올해의 책 — 그해 열어 본 책들을 한 권으로 묶어 보여 준다.

  저장하지 않고 그때그때 계산한다. 열어 본 책이 늘면 올해의 책도 달라진다. 하트가 있으면 "가장 사랑받은 사진·책"이
  나오고, 없으면 그 칸은 비운다. 책꽂이와 같이 안 열어 본 엽서는 넣지 않는다.
*/

export interface LovedPhoto {
  card: InboxCard;
  file: string;
  n: number;
}

export interface LovedBook {
  card: InboxCard;
  n: number;
}

export interface YearBook {
  year: string;
  /** 그해 열어 본 책. 다녀온 날 오름차순. */
  cards: InboxCard[];
  stats: { trips: number; places: number; photos: number; hearts: number };
  /** 표지 모자이크에 쓸 책(최대 4). 사랑받은 책이 먼저. */
  covers: InboxCard[];
  /** 하트 많이 받은 사진(최대 6). */
  lovedPhotos: LovedPhoto[];
  /** 하트 많이 받은 책(최대 3). */
  lovedBooks: LovedBook[];
  /** 여행이 있는 달만, 1월부터. */
  months: { month: number; cards: InboxCard[] }[];
}

const COVERS = 4;
const LOVED_PHOTOS = 6;
const LOVED_BOOKS = 3;

/** 책을 가르는 날. 다녀온 날, 모르면 보낸 날. */
const dateOf = (card: InboxCard): string => card.startedOn || card.sentAt;

const heartsOf = (card: InboxCard): number => card.heartCounts.reduce((sum, entry) => sum + (entry.n > 0 ? entry.n : 0), 0);

/** 많은 순, 같으면 최근에 다녀온 책이 먼저. */
const byLoveThenNewer = <T extends { n: number; card: InboxCard }>(a: T, b: T): number =>
  b.n - a.n || dateOf(b.card).localeCompare(dateOf(a.card));

/** 이 해의 올해의 책. 그해 열어 본 책이 없으면(또는 날짜를 모르는 책들이면) null. */
export function yearBook(cards: InboxCard[], year: string): YearBook | null {
  if (year === "") return null;
  const entry = shelfYears(cards).find((item) => item.year === year);
  if (!entry) return null;

  const books = [...entry.cards].sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const steps = yearSteps(books);

  const lovedPhotos: LovedPhoto[] = books
    .flatMap((card) => card.heartCounts.filter((heart) => heart.file !== "" && heart.n > 0).map((heart) => ({ card, file: heart.file, n: heart.n })))
    .sort(byLoveThenNewer)
    .slice(0, LOVED_PHOTOS);

  const lovedAll: LovedBook[] = books.map((card) => ({ card, n: heartsOf(card) })).sort(byLoveThenNewer);
  const lovedBooks = lovedAll.filter((item) => item.n > 0).slice(0, LOVED_BOOKS);

  // 사랑받은 책이 먼저, 나머지는 최근에 다녀온 책부터. 표지 그림이 없는 책은 모자이크에 못 쓴다.
  const covers = lovedAll
    .map((item) => item.card)
    .filter((card) => card.cover)
    .slice(0, COVERS);

  const byMonth = new Map<number, InboxCard[]>();
  for (const card of books) {
    const month = Number(dateOf(card).slice(5, 7));
    if (!(month >= 1 && month <= 12)) continue;
    byMonth.set(month, [...(byMonth.get(month) ?? []), card]);
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0] - b[0]).map(([month, list]) => ({ month, cards: list }));

  return {
    year,
    cards: books,
    stats: {
      trips: books.length,
      places: steps.length,
      photos: books.reduce((sum, card) => sum + card.photoCount, 0),
      hearts: books.reduce((sum, card) => sum + heartsOf(card), 0),
    },
    covers,
    lovedPhotos,
    lovedBooks,
    months,
  };
}

/**
 * 올해의 책을 알릴 해. 12월에는 그해, 1~2월에는 지난해이고 그 밖의 달에는 없다(null).
 * 그해에 열어 본 책이 있어야 한다. today 는 이 폰의 오늘("2026-12-05"), 모르면("") 없다.
 */
export function yearBookSeason(cards: InboxCard[], today: string): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(today);
  if (!match) return null;
  const month = Number(match[2]);
  const year = month === 12 ? match[1] : month === 1 || month === 2 ? String(Number(match[1]) - 1) : null;
  if (!year) return null;
  return shelfYears(cards).some((entry) => entry.year === year) ? year : null;
}
