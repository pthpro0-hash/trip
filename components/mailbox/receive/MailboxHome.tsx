"use client";

import { useState, useSyncExternalStore, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { InboxCard, MailboxView } from "@/lib/supabase/mailboxPublic";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";
import { FONT_SCALE } from "@/lib/mailboxSettings";
import { postcardPath } from "@/lib/mailbox";
import { lastYearLabel, lastYearToday, shelfYears, yearTitle, type ShelfYear } from "@/lib/mailboxShelf";
import { useWho } from "@/lib/mailboxWho";
import { PreviewBanner } from "./PreviewBanner";
import { WhoPicker } from "./WhoPicker";

/*
  우편함 첫 화면 — 부모님이 보는 곳.

  글씨는 크게(본문 18px 이상), 단추는 손가락 하나 크기로. 할 수 있는 일은 "열어 보기"뿐이다. 설정·메뉴·계정은 없다.

  위에서 아래로: 새로 온 엽서(큰 카드 — 안 열어 본 것) → 작년 오늘(오늘 즈음 다녀온 책, 있을 때만) → 책꽂이
  (열어 본 책을 해마다 꽂아 둔다. 가장 새 해만 펼쳐 있고, 해마다 그해 다녀온 곳을 지도로 볼 수 있다).
  열어 보면 큰 카드에서 책꽂이로 내려간다 — 새 엽서가 책꽂이에 묻히지 않는다.
*/

/** 지도는 무거워서 단추를 눌렀을 때만 불러온다. 부모님 폰의 데이터를 아낀다. */
const YearMap = dynamic(() => import("./YearMap").then((module) => module.YearMap), {
  ssr: false,
  loading: () => <p className="rs-18 text-text-muted">지도를 불러오는 중…</p>,
});

const pad = (n: number) => String(n).padStart(2, "0");

/** 이 폰의 오늘("2026-10-07"). 서버가 그린 첫 그림에서는 모른다("") — 서버의 날짜와 폰의 날짜가 다를 수 있어서다. */
const noSubscribe = () => () => undefined;
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
function useToday(): string {
  return useSyncExternalStore(noSubscribe, todayKey, () => "");
}

/** 보낸 때를 "10월 2일"로. */
const sentDay = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

/** 다녀온 날("2026-09-13")을 글자 그대로 읽는다. new Date 로 읽으면 시간대에 따라 하루가 밀린다. */
const tripDay = (day: string, withYear = false) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return "";
  const text = `${Number(match[2])}월 ${Number(match[3])}일`;
  return withYear ? `${match[1]}년 ${text}` : text;
};

function Cover({ card, className }: { card: InboxCard; className: string }) {
  return (
    <span className={`relative grid place-items-center overflow-hidden bg-bg-subtle ${className}`}>
      {card.cover ? (
        // 우리 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다. 보일 때만 불러온다(책이 많아도 가볍게).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={postcardFileUrl(card.id, card.cover)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true" className="rs-28">
          ✉️
        </span>
      )}
    </span>
  );
}

/** 안 열어 본 엽서 — 큰 카드. */
function Card({ token, card, preview }: { token: string; card: InboxCard; preview: boolean }) {
  const last = card.replies.at(-1);
  return (
    <li>
      <Link
        href={postcardPath(token, card.id, preview)}
        className="flex items-center gap-4 rounded-3xl bg-surface p-3.5 ring-1 ring-line transition active:scale-[0.99]"
      >
        <Cover card={card} className="h-24 w-24 shrink-0 rounded-2xl" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate rs-22 font-bold leading-snug tracking-tight text-text">{card.title || "여행 엽서"}</span>
            {!card.opened && (
              <span className="shrink-0 rounded-full bg-[#e2661b] px-2.5 py-0.5 rs-14 font-bold text-white">새 엽서</span>
            )}
          </span>
          <span className="rs-17 text-text-muted">
            {card.senderName} · {sentDay(card.sentAt) || card.startedOn}
            {card.photoCount > 0 && ` · 사진 ${card.photoCount}장`}
          </span>
          {last && (
            <span className="truncate rs-16 text-accent">
              {last.who}: {last.reaction}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/** 책꽂이의 책 한 권 — 표지. */
function Book({ token, card, preview }: { token: string; card: InboxCard; preview: boolean }) {
  const last = card.replies.at(-1);
  return (
    <li>
      <Link href={postcardPath(token, card.id, preview)} className="flex flex-col gap-2 transition active:scale-[0.98]">
        <Cover card={card} className="aspect-[3/4] w-full rounded-2xl" />
        <span className="line-clamp-2 rs-18 font-bold leading-snug text-text">{card.title || "여행 엽서"}</span>
        <span className="rs-14 leading-snug text-text-muted">
          {tripDay(card.startedOn) || sentDay(card.sentAt)} · {card.senderName}
          {card.photoCount > 0 && ` · 사진 ${card.photoCount}장`}
        </span>
        {last && (
          <span className="truncate rs-14 text-accent">
            {last.who}: {last.reaction}
          </span>
        )}
      </Link>
    </li>
  );
}

/** 한 해의 책꽂이. 접었다 펼 수 있고, 펼치면 표지와 그해 지도 단추가 나온다. */
function Year({ token, entry, defaultOpen, preview }: { token: string; entry: ShelfYear; defaultOpen: boolean; preview: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [mapOpen, setMapOpen] = useState(false);
  const title = yearTitle(entry.year, entry.cards.length);
  const label = entry.year === "" ? "날짜 모름" : `${entry.year}년`;
  const hasPlaces = entry.year !== "" && entry.cards.some((card) => card.places.length > 0);

  return (
    <section className="flex flex-col gap-3">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-bg-subtle px-5 rs-22 font-bold text-text transition active:scale-[0.99]"
        >
          <span>{title}</span>
          <span aria-hidden="true" className="rs-20 text-text-muted">
            {open ? "▾" : "▸"}
          </span>
        </button>
      </h2>

      {open && (
        <>
          <ul aria-label={`${title} 책꽂이`} className="grid grid-cols-2 gap-x-3.5 gap-y-5">
            {entry.cards.map((card) => (
              <Book key={card.id} token={token} card={card} preview={preview} />
            ))}
          </ul>

          {hasPlaces && (
            <>
              <button
                type="button"
                onClick={() => setMapOpen((current) => !current)}
                className="min-h-14 rounded-2xl bg-accent-soft px-5 rs-18 font-semibold text-accent transition active:scale-[0.99]"
              >
                {mapOpen ? `${label} 지도 닫기` : `${label} 다녀온 곳 지도로 보기`}
              </button>
              {mapOpen && <YearMap year={entry.year} cards={entry.cards} />}
            </>
          )}
        </>
      )}
    </section>
  );
}

/** 오늘 즈음 다녀온 지난 해의 책 한 권. */
function LastYear({ token, card, yearsAgo, preview }: { token: string; card: InboxCard; yearsAgo: number; preview: boolean }) {
  const label = lastYearLabel(yearsAgo);
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <p className="px-1 rs-18 font-bold text-accent">{label}</p>
      <Link
        href={postcardPath(token, card.id, preview)}
        className="flex items-center gap-4 rounded-3xl bg-accent-soft p-3.5 transition active:scale-[0.99]"
      >
        <Cover card={card} className="h-24 w-24 shrink-0 rounded-2xl" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate rs-22 font-bold leading-snug tracking-tight text-text">{card.title || "여행 엽서"}</span>
          <span className="rs-17 text-text-muted">
            {tripDay(card.startedOn, true)} · {card.senderName}
          </span>
        </span>
      </Link>
    </section>
  );
}

/**
 * today 는 시험에서 오늘을 정해 줄 때만 쓴다. 평소에는 이 폰의 오늘을 쓴다.
 * preview 는 보내는 사람이 부모님 화면을 미리 보는 중이다 — 띠를 달고, 엽서로 가는 길에 그 표시를 잇고,
 * 부모님이 고르는 '누가 보시나요?'는 묻지 않는다.
 */
export function MailboxHome({ token, view, today, preview = false }: { token: string; view: MailboxView; today?: string; preview?: boolean }) {
  const who = useWho(token);
  const phoneToday = useToday();
  const fresh = view.postcards.filter((card) => !card.opened);
  const years = shelfYears(view.postcards);
  const past = view.settings.past ? lastYearToday(view.postcards.filter((card) => card.opened), today ?? phoneToday) : null;

  return (
    <main
      style={{ "--rs": FONT_SCALE[view.settings.font] } as CSSProperties}
      className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 pb-16 pt-8"
    >
      {preview && <PreviewBanner />}

      <header className="flex flex-col gap-2">
        <h1 className="rs-32 font-bold tracking-tight text-text">우리 가족 우편함</h1>
        <p className="rs-18 leading-relaxed text-text-muted">
          {view.postcards.length === 0
            ? "아직 도착한 엽서가 없어요. 가족이 여행을 다녀오면 이곳으로 엽서가 와요."
            : fresh.length > 0
              ? `새 엽서가 ${fresh.length}장 도착했어요.`
              : `받은 엽서 ${view.postcards.length}장`}
        </p>
        {who && !preview && <WhoPicker token={token} members={view.members} compact />}
      </header>

      {!preview && <WhoPicker token={token} members={view.members} />}

      {fresh.length > 0 && (
        <ul className="flex flex-col gap-3.5" aria-label="새로 온 엽서">
          {fresh.map((card) => (
            <Card key={card.id} token={token} card={card} preview={preview} />
          ))}
        </ul>
      )}

      {past && <LastYear token={token} card={past.card} yearsAgo={past.yearsAgo} preview={preview} />}

      {years.map((entry, index) => (
        <Year key={entry.year} token={token} entry={entry} defaultOpen={index === 0} preview={preview} />
      ))}

      <section className="mt-auto rounded-2xl bg-bg-subtle p-5 rs-16 leading-relaxed text-text-muted">
        <p className="font-semibold text-text">홈 화면에 두면 편해요</p>
        <p className="mt-1">
          아이폰은 아래 가운데 공유 단추를 누르고 &lsquo;홈 화면에 추가&rsquo;, 안드로이드는 위 메뉴(점 세 개)에서
          &lsquo;홈 화면에 추가&rsquo;를 누르세요. 다음부터는 아이콘 하나로 바로 열려요.
        </p>
      </section>
    </main>
  );
}
