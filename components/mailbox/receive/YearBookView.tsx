"use client";

import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { MailboxView } from "@/lib/supabase/mailboxPublic";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";
import { mailboxPath, postcardPath } from "@/lib/mailbox";
import { FONT_SCALE } from "@/lib/mailboxSettings";
import { yearBook } from "@/lib/mailboxYearBook";
import { PreviewBanner } from "./PreviewBanner";
import { Cover, YearMap } from "./shelfParts";

/*
  올해의 책 — 그해 열어 본 책들을 한 권으로 묶어 보는 화면.

  저장하지 않고 열어 본 책에서 그때그때 만든다. 위에서 아래로: 표지(그림 몇 장과 숫자) → 가장 사랑받은 사진 →
  가장 사랑받은 책 → 한 해 다녀온 길(지도) → 달마다. 하트가 없으면 '사랑받은' 두 칸은 비운다.
  설정에서 올해의 책을 끈 우편함이면 열지 않는다(주소를 직접 열어도).
*/

const MOSAIC: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2", 4: "grid-cols-2" };

export function YearBookView({ token, view, year, preview = false }: { token: string; view: MailboxView; year: string; preview?: boolean }) {
  const back = mailboxPath(token, preview);
  const scale = { "--rs": FONT_SCALE[view.settings.font] } as CSSProperties;
  const book = view.settings.year ? yearBook(view.postcards, year) : null;

  const shell = (children: ReactNode) => (
    <main style={scale} className="mx-auto flex min-h-screen max-w-xl flex-col gap-7 px-5 pb-16 pt-8">
      {preview && <PreviewBanner />}
      <Link href={back} className="self-start rs-18 font-semibold text-accent">
        ← 우편함
      </Link>
      {children}
    </main>
  );

  if (!view.settings.year) {
    return shell(
      <header className="flex flex-col gap-2">
        <h1 className="rs-28 font-bold text-text">올해의 책은 지금 쓰지 않고 있어요</h1>
        <p className="rs-18 leading-relaxed text-text-muted">보내는 가족이 올해의 책을 꺼 두었어요. 우편함에서 엽서와 책꽂이는 그대로 볼 수 있어요.</p>
      </header>,
    );
  }

  if (!book) {
    return shell(
      <header className="flex flex-col gap-2">
        <h1 className="rs-28 font-bold text-text">{year}년의 책은 아직 없어요</h1>
        <p className="rs-18 leading-relaxed text-text-muted">열어 본 엽서가 모이면 한 해의 책이 만들어져요.</p>
      </header>,
    );
  }

  const { stats } = book;
  const summary = [
    `${stats.trips}번 다녀왔어요`,
    stats.places > 0 ? `${stats.places}곳` : null,
    stats.photos > 0 ? `사진 ${stats.photos}장` : null,
    stats.hearts > 0 ? `하트 ${stats.hearts}개` : null,
  ]
    .filter((part): part is string => part !== null)
    .map((part) => part.replace(/ /g, "\u00a0"))
    .join(" · ");

  return shell(
    <>
      <header className="flex flex-col gap-3">
        <p className="rs-18 font-semibold text-accent">우리 가족 올해의 책</p>
        <h1 className="rs-32 font-bold tracking-tight text-text">{year}년</h1>
        {book.covers.length > 0 && (
          <div data-testid="mosaic" className={`grid gap-2 ${MOSAIC[book.covers.length]}`}>
            {book.covers.map((card) => (
              <Cover key={card.id} card={card} className="aspect-[4/3] w-full rounded-2xl" />
            ))}
          </div>
        )}
        <p className="rs-20 leading-relaxed text-text">{summary}</p>
      </header>

      {book.lovedPhotos.length > 0 && (
        <section aria-label="가장 사랑받은 사진" className="flex flex-col gap-3">
          <h2 className="rs-24 font-bold text-text">가장 사랑받은 사진</h2>
          <ul className="grid grid-cols-3 gap-2">
            {book.lovedPhotos.map((photo) => (
              <li key={`${photo.card.id}/${photo.file}`}>
                <Link
                  href={postcardPath(token, photo.card.id, preview)}
                  aria-label={`${photo.card.title || "여행 엽서"} 사진, 하트 ${photo.n}개`}
                  className="relative block aspect-square overflow-hidden rounded-2xl bg-bg-subtle"
                >
                  {/* 우리 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={postcardFileUrl(photo.card.id, photo.file)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span aria-hidden="true" className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 rs-14 font-bold text-[#e0245e]">
                    ♥ {photo.n}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {book.lovedBooks.length > 0 && (
        <section aria-label="가장 사랑받은 책" className="flex flex-col gap-3">
          <h2 className="rs-24 font-bold text-text">가장 사랑받은 책</h2>
          <ul className="flex flex-col gap-3">
            {book.lovedBooks.map(({ card, n }) => (
              <li key={card.id}>
                <Link href={postcardPath(token, card.id, preview)} className="flex items-center gap-4 rounded-3xl bg-surface p-3 ring-1 ring-line">
                  <Cover card={card} className="h-20 w-20 shrink-0 rounded-2xl" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate rs-20 font-bold text-text">{card.title || "여행 엽서"}</span>
                    <span className="rs-16 font-semibold text-[#e0245e]">하트 {n}개</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.places > 0 && (
        <section aria-label="한 해 다녀온 길" className="flex flex-col gap-3">
          {/* 지도 위에 '2026년 다녀온 곳' 제목이 이미 있다. */}
          <YearMap year={year} cards={book.cards} />
        </section>
      )}

      <section aria-label="달마다" className="flex flex-col gap-3">
        <h2 className="rs-24 font-bold text-text">달마다</h2>
        <ol className="flex flex-col gap-4">
          {book.months.map(({ month, cards }) => (
            <li key={month} className="flex flex-col gap-2">
              <p className="rs-18 font-bold text-accent">{month}월</p>
              <ul className="flex flex-col gap-2">
                {cards.map((card) => (
                  <li key={card.id}>
                    <Link href={postcardPath(token, card.id, preview)} className="flex items-center gap-3 rounded-2xl bg-bg-subtle px-4 py-3">
                      <span className="min-w-0 flex-1 truncate rs-20 font-semibold text-text">{card.title || "여행 엽서"}</span>
                      <span aria-hidden="true" className="rs-20 text-text-faint">
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <Link href={back} className="flex min-h-14 items-center justify-center rounded-2xl bg-bg-subtle rs-20 font-semibold text-text">
        우편함으로 가기
      </Link>
    </>,
  );
}
