"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import type { InboxCard, MailboxView } from "@/lib/supabase/mailboxPublic";
import { FONT_SCALE } from "@/lib/mailboxSettings";
import { mailboxPath, postcardPath, wishPath, yearBookPath, type PreviewMode } from "@/lib/mailbox";
import { lastYearLabel, lastYearToday, shelfYears, yearTitle, type ShelfYear } from "@/lib/mailboxShelf";
import { yearBookSeason } from "@/lib/mailboxYearBook";
import { useWho } from "@/lib/mailboxWho";
import { PreviewBanner } from "./PreviewBanner";
import { Cover, YearMap, sentDay, tripDay, useToday } from "./shelfParts";
import { WhoPicker } from "./WhoPicker";

/*
  책장 첫 화면 — 부모님이 보는 곳.

  글씨는 크게(본문 18px 이상), 단추는 손가락 하나 크기로. 할 수 있는 일은 "열어 보기"뿐이다. 설정·메뉴·계정은 없다.

  위에서 아래로: 새로 온 엽서(큰 카드 — 안 열어 본 것) → 올해의 책(12월~2월에만) → 작년 오늘(오늘 즈음 다녀온 책,
  있을 때만) → 책꽂이(열어 본 책을 해마다 꽂아 둔다. 가장 새 해만 펼쳐 있고, 해마다 그해 다녀온 곳을 지도로,
  그해를 한 권으로 볼 수 있다). 열어 보면 큰 카드에서 책꽂이로 내려간다 — 새 엽서가 책꽂이에 묻히지 않는다.
*/

/** 안 열어 본 엽서 — 큰 카드. */
function Card({ token, card, preview }: { token: string; card: InboxCard; preview: PreviewMode }) {
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
function Book({ token, card, preview }: { token: string; card: InboxCard; preview: PreviewMode }) {
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

/** 해 제목 아래 두 단추의 모양 — 한 줄에 반씩. 글씨를 아주 크게 해도 좁은 폰에서 줄이 바뀔 뿐 넘치지 않게. */
const shortButton =
  "flex min-h-14 min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-2 text-center rs-17 font-semibold leading-snug break-keep transition active:scale-[0.99]";

/** 한 해의 책꽂이. 접었다 펼 수 있고, 펼치면 맨 위에 올해의 책·지도 단추, 그 밑에 표지가 나온다. */
function Year({
  token,
  entry,
  defaultOpen,
  preview,
  showBook,
}: {
  token: string;
  entry: ShelfYear;
  defaultOpen: boolean;
  preview: PreviewMode;
  showBook: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mapOpen, setMapOpen] = useState(false);
  const title = yearTitle(entry.year, entry.cards.length);
  const label = entry.year === "" ? "날짜 모름" : `${entry.year}년`;
  const hasPlaces = entry.year !== "" && entry.cards.some((card) => card.places.length > 0);
  const hasBook = showBook && entry.year !== "";

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
          {/* 해 제목 바로 아래에 한 줄로. 짧게 적고, 어느 해인지는 읽어 주는 이름에만 둔다(바로 위에 해가 적혀 있다). */}
          {(hasBook || hasPlaces) && (
            <div className="flex gap-2.5">
              {hasBook && (
                <Link
                  href={yearBookPath(token, entry.year, preview)}
                  aria-label={`${label} 올해의 책 보기`}
                  className={`${shortButton} bg-accent text-on-accent`}
                >
                  <span aria-hidden="true">📖</span> 올해의 책 보기
                </Link>
              )}
              {hasPlaces && (
                <button
                  type="button"
                  aria-label={mapOpen ? `${label} 지도 닫기` : `${label} 다녀온 곳 지도로 보기`}
                  aria-expanded={mapOpen}
                  onClick={() => setMapOpen((current) => !current)}
                  className={`${shortButton} bg-accent-soft text-accent`}
                >
                  <span aria-hidden="true">🗺️</span> {mapOpen ? "지도 닫기" : "지도로 보기"}
                </button>
              )}
            </div>
          )}

          {mapOpen && hasPlaces && <YearMap year={entry.year} cards={entry.cards} />}

          <ul aria-label={`${title} 책꽂이`} className="grid grid-cols-2 gap-x-3.5 gap-y-5">
            {entry.cards.map((card) => (
              <Book key={card.id} token={token} card={card} preview={preview} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** 올해의 책이 만들어졌다는 알림(12월~2월). */
function YearBookNotice({ token, year, preview }: { token: string; year: string; preview: PreviewMode }) {
  return (
    <Link
      href={yearBookPath(token, year, preview)}
      className="flex items-center gap-4 rounded-3xl bg-accent p-4 text-on-accent transition active:scale-[0.99]"
    >
      <span aria-hidden="true" className="rs-32">
        📖
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="rs-22 font-bold leading-snug">{year}년 올해의 책이 만들어졌어요</span>
        <span className="rs-16 opacity-90">한 해를 한 권으로 모아 봤어요</span>
      </span>
      <span aria-hidden="true" className="rs-24">
        ›
      </span>
    </Link>
  );
}

/** 오늘 즈음 다녀온 지난 해의 책 한 권. */
function LastYear({ token, card, yearsAgo, preview }: { token: string; card: InboxCard; yearsAgo: number; preview: PreviewMode }) {
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
export function MailboxHome({ token, view, today, preview = false }: { token: string; view: MailboxView; today?: string; preview?: PreviewMode }) {
  const who = useWho(token);
  const phoneToday = useToday();
  const fresh = view.postcards.filter((card) => !card.opened);
  const years = shelfYears(view.postcards);
  const now = today ?? phoneToday;
  const past = view.settings.past ? lastYearToday(view.postcards.filter((card) => card.opened), now) : null;
  const seasonYear = view.settings.year ? yearBookSeason(view.postcards, now) : null;

  return (
    <main
      style={{ "--rs": FONT_SCALE[view.settings.font] } as CSSProperties}
      className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 pb-16 pt-8"
    >
      {preview && <PreviewBanner all={preview === "all"} toggle={{ href: mailboxPath(token, preview === "all" ? true : "all") }} />}

      <header className="flex flex-col gap-2">
        <h1 className="rs-32 font-bold tracking-tight text-text">우리 가족 책장</h1>
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

      {seasonYear && <YearBookNotice token={token} year={seasonYear} preview={preview} />}

      {past && <LastYear token={token} card={past.card} yearsAgo={past.yearsAgo} preview={preview} />}

      {years.map((entry, index) => (
        <Year key={entry.year} token={token} entry={entry} defaultOpen={index === 0} preview={preview} showBook={view.settings.year} />
      ))}

      {view.settings.wish && (
        <Link
          href={wishPath(token, preview)}
          className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-accent px-5 py-3 text-on-accent transition active:scale-[0.99]"
        >
          <span className="rs-22 font-bold">♡ 가고 싶은 곳 보내기</span>
          {view.wishes.length > 0 && <span className="rs-16 opacity-90">{view.wishes.length}곳 보냈어요</span>}
        </Link>
      )}

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
