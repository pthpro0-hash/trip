"use client";

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { seasonOfMonth, type FootprintStep } from "@/lib/footprint";
import { mailboxPath, yearBookPath, type PreviewMode } from "@/lib/mailbox";
import { legendOf, splitTripPhotos } from "@/lib/mailboxBook";
import { yearSteps } from "@/lib/mailboxShelf";
import { yearBook } from "@/lib/mailboxYearBook";
import { project } from "@/lib/koreaMap";
import { dotsViewBox } from "@/lib/photo/regionView";
import { sidoShapes } from "@/lib/sidoShapes";
import { SEASON_COLOR } from "@/lib/sketch";
import { postcardFileUrl, type MailboxView } from "@/lib/supabase/mailboxPublic";
import { PreviewBanner } from "./PreviewBanner";

/*
  올해의 책을 쪽으로 나눈 인쇄용 책. 화면에는 쪽이 위아래로 쌓여 보이고, [PDF로 저장]을 누르면 브라우저의 인쇄 창이 열려
  PDF 로 저장할 수 있다(별도의 PDF 프로그램도 결제도 없다).

  쪽 크기는 A5 세로(148×210mm). 쪽 안의 색은 고정이다 — 어두운 화면 설정이어도 종이에는 흰 바탕에 어두운 글씨로 나온다.
  그림은 바로 불러온다(lazy 가 아니다): 보일 때만 불러오면 인쇄할 때 빠진다. 다 불러오기 전에는 저장 단추를 막는다.
  사진은 책장에 있는 크기(약 640px)라 가족끼리 보는 기념 PDF에 알맞다 — 전문 인쇄소용 고화질은 아니다.
*/

/** A5 를 화면 픽셀로(96dpi): 148mm ≈ 559px. 좁은 화면에서는 이 비율로 줄여 보인다. */
const PAGE_PX = 559;

const subscribeResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
/** 화면 폭에 맞춘 쪽 배율. 인쇄할 때는 쓰지 않는다(아래 스타일의 print 규칙). 서버가 그린 첫 그림은 1. */
function useBookZoom(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => Math.round(Math.min(1, Math.max(0.3, (window.innerWidth - 32) / PAGE_PX)) * 100) / 100,
    () => 1,
  );
}

/** 이 화면의 그림이 얼마나 불러와졌나. 실패한 그림도 센다(지워진 사진 때문에 영영 못 저장하게 되지 않게). */
function useImageProgress(rootRef: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState({ loaded: 0, total: -1 });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const images = [...root.querySelectorAll("img")];
    let loaded = images.filter((image) => image.complete).length;
    const pending = images.filter((image) => !image.complete);
    const update = () => setProgress({ loaded, total: images.length });
    const cleanups = pending.map((image) => {
      const done = () => {
        loaded += 1;
        update();
      };
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
      return () => {
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
      };
    });
    // 처음 한 번은 효과가 끝난 뒤에 알린다(효과 안의 동기 setState 가 아니게).
    void Promise.resolve().then(update);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [rootRef]);
  return progress;
}

const MUTED = "text-[#666]";
const INK = "text-[#222]";

/** 그림 하나. 인쇄용이라 바로 불러온다. */
function Photo({ id, file, className }: { id: string; file: string; className: string }) {
  return (
    // 우리 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={postcardFileUrl(id, file)} alt="" loading="eager" decoding="async" className={`h-full w-full object-cover ${className}`} />
  );
}

function Page({ kind, no, children }: { kind: string; no?: number; children: ReactNode }) {
  return (
    <section
      data-page={kind}
      className="book-page relative flex h-[210mm] w-[148mm] shrink-0 flex-col overflow-hidden bg-white p-[12mm] text-[#222] shadow-lg"
    >
      {children}
      {no !== undefined && <p className={`absolute bottom-[6mm] left-0 right-0 text-center text-[10px] ${MUTED}`}>— {no} —</p>}
    </section>
  );
}

/** 다녀온 곳을 전국 지도에 점으로(번호는 쪽 아래 목록과 같다). 한장 요약의 발자취 지도를 가만히 그린 것. */
function BookMap({ steps }: { steps: FootprintStep[] }) {
  const frame = { width: 340, height: 400 };
  const view = dotsViewBox(steps, frame);
  const k = view.width / frame.width;
  return (
    <svg
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label="다녀온 곳 지도"
      className="block h-full w-full"
    >
      <rect x={view.x} y={view.y} width={view.width} height={view.height} fill="#dbeafe" />
      <g opacity={0.6}>
        {sidoShapes().list.map((sido) => (
          <path key={sido.name} d={sido.d} fillRule="evenodd" fill="#f5f3ec" stroke="#b6c6d2" strokeWidth={0.9 * k} strokeLinejoin="round" />
        ))}
      </g>
      {steps.map((step, index) => {
        const point = project(step.lat, step.lng);
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
        const color = SEASON_COLOR[seasonOfMonth(step.month)];
        return (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={5 * k} fill={color} stroke="#fff" strokeWidth={1.5 * k} />
            <text x={point.x + 7 * k} y={point.y - 6 * k} fontSize={11 * k} fontWeight={700} fill="#222" stroke="#fff" strokeWidth={2.5 * k} paintOrder="stroke">
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function YearBookPrint({
  token,
  view,
  year,
  filesById,
  preview = false,
}: {
  token: string;
  view: MailboxView;
  year: string;
  /** 엽서마다 지금 남아 있는 사진 파일들(엽서 한 장을 읽어 온 것). 없으면 표지 사진 하나만. */
  filesById: Record<string, string[]>;
  preview?: PreviewMode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const zoom = useBookZoom();
  const progress = useImageProgress(rootRef);

  const back = yearBookPath(token, year, preview);
  const book = view.settings.year ? yearBook(view.postcards, year) : null;

  const shell = (children: ReactNode) => (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-16 pt-8">
      {preview && (
        <div className="print:hidden">
          <PreviewBanner />
        </div>
      )}
      <Link href={mailboxPath(token, preview)} className="self-start text-[18px] font-semibold text-accent print:hidden">
        ← 책장
      </Link>
      {children}
    </main>
  );

  if (!view.settings.year) {
    return shell(
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold text-text">올해의 책은 지금 쓰지 않고 있어요</h1>
        <p className="text-[17px] leading-relaxed text-text-muted">보내는 가족이 올해의 책을 꺼 두었어요.</p>
      </header>,
    );
  }
  if (!book) {
    return shell(
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] font-bold text-text">{year}년의 책은 아직 없어요</h1>
        <p className="text-[17px] leading-relaxed text-text-muted">열어 본 엽서가 모이면 한 해의 책이 만들어져요.</p>
      </header>,
    );
  }

  const steps = yearSteps(book.cards);
  const legend = legendOf(steps);
  const { stats } = book;
  const summary = [
    `${stats.trips}번 다녀왔어요`,
    stats.places > 0 ? `${stats.places}곳` : null,
    stats.photos > 0 ? `사진 ${stats.photos}장` : null,
    stats.hearts > 0 ? `하트 ${stats.hearts}개` : null,
  ]
    .filter((part): part is string => part !== null)
    .map((part) => part.replace(/ /g, " "))
    .join(" · ");

  const ready = progress.total >= 0 && progress.loaded >= progress.total;
  const label = ready ? "PDF로 저장" : progress.total < 0 ? "준비하는 중…" : `사진 불러오는 중 ${progress.loaded}/${progress.total}`;

  /** 쪽을 차례대로 모은다. 번호는 표지를 뺀 쪽부터. */
  const pages: { kind: string; node: (no?: number) => ReactNode }[] = [];

  pages.push({
    kind: "cover",
    node: () => (
      <Page kind="cover">
        <p className="mt-[8mm] text-[15px] font-semibold text-[#0071e3]">우리 가족 올해의 책</p>
        <h1 className={`mt-1 text-[44px] font-bold leading-tight tracking-tight ${INK}`}>{year}년</h1>
        {book.covers.length > 0 && (
          <div className={`mt-[8mm] grid gap-1.5 ${book.covers.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {book.covers.map((card) => (
              <div key={card.id} className="aspect-[4/3] overflow-hidden rounded-lg bg-[#f4f4f6]">
                {card.cover && <Photo id={card.id} file={card.cover} className="" />}
              </div>
            ))}
          </div>
        )}
        <p className={`mt-[8mm] text-[17px] leading-relaxed ${INK}`}>{summary}</p>
        <p className={`mt-auto text-[12px] ${MUTED}`}>내 여행 스케치로 만든 책</p>
      </Page>
    ),
  });

  if (book.lovedPhotos.length > 0) {
    pages.push({
      kind: "loved-photos",
      node: (no) => (
        <Page kind="loved-photos" no={no}>
          <h2 className={`text-[22px] font-bold ${INK}`}>가장 사랑받은 사진</h2>
          <div className="mt-[6mm] grid grid-cols-2 gap-2">
            {book.lovedPhotos.map((photo) => (
              <figure key={`${photo.card.id}/${photo.file}`} className="flex flex-col gap-1">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#f4f4f6]">
                  <Photo id={photo.card.id} file={photo.file} className="" />
                  <span className="absolute bottom-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-[#e0245e]">♥ {photo.n}</span>
                </div>
                <figcaption className={`text-[11px] ${MUTED}`}>{photo.card.title || "여행 엽서"}</figcaption>
              </figure>
            ))}
          </div>
        </Page>
      ),
    });
  }

  if (book.lovedBooks.length > 0) {
    pages.push({
      kind: "loved-books",
      node: (no) => (
        <Page kind="loved-books" no={no}>
          <h2 className={`text-[22px] font-bold ${INK}`}>가장 사랑받은 책</h2>
          <ul className="mt-[6mm] flex flex-col gap-3">
            {book.lovedBooks.map(({ card, n }) => (
              <li key={card.id} className="flex items-center gap-3">
                <div className="h-[28mm] w-[28mm] shrink-0 overflow-hidden rounded-lg bg-[#f4f4f6]">{card.cover && <Photo id={card.id} file={card.cover} className="" />}</div>
                <div className="min-w-0">
                  <p className={`text-[16px] font-bold ${INK}`}>{card.title || "여행 엽서"}</p>
                  <p className="text-[13px] font-semibold text-[#e0245e]">하트 {n}개</p>
                </div>
              </li>
            ))}
          </ul>
        </Page>
      ),
    });
  }

  if (steps.length > 0) {
    pages.push({
      kind: "map",
      node: (no) => (
        <Page kind="map" no={no}>
          <h2 className={`text-[22px] font-bold ${INK}`}>한 해 다녀온 길</h2>
          {/* 지도 칸은 곳 목록(서른 곳까지)을 적고 남은 높이만큼 — 곳이 많아도 쪽 밖으로 넘치지 않는다. */}
          <div className="mt-[4mm] min-h-0 flex-1 overflow-hidden rounded-lg bg-[#dbeafe]">
            <BookMap steps={steps} />
          </div>
          <ol className="mt-[4mm] mb-[6mm] grid grid-cols-2 gap-x-3 gap-y-0.5">
            {legend.rows.map((row) => (
              <li key={row.n} className={`truncate text-[10.5px] ${INK}`}>
                {row.n}. {row.name} <span className={MUTED}>{row.when}</span>
              </li>
            ))}
          </ol>
          {legend.more > 0 && <p className={`mt-1 text-[10.5px] ${MUTED}`}>외 {legend.more}곳</p>}
        </Page>
      ),
    });
  }

  pages.push({
    kind: "months",
    node: (no) => (
      <Page kind="months" no={no}>
        <h2 className={`text-[22px] font-bold ${INK}`}>달마다</h2>
        <ol className="mt-[6mm] flex flex-col gap-3">
          {book.months.map(({ month, cards }) => (
            <li key={month}>
              <p className="text-[15px] font-bold text-[#0071e3]">{month}월</p>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {cards.map((card) => (
                  <li key={card.id} className={`text-[14px] ${INK}`}>
                    {card.title || "여행 엽서"}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Page>
    ),
  });

  for (const card of book.cards) {
    const files = filesById[card.id] ?? (card.cover ? [card.cover] : []);
    const { first, rest } = splitTripPhotos(files);
    const day = /^\d{4}-(\d{2})-(\d{2})$/.exec(card.startedOn);
    const when = day ? `${Number(day[1])}월 ${Number(day[2])}일` : "";
    pages.push({
      kind: "trip",
      node: (no) => (
        <Page kind="trip" no={no}>
          <h2 className={`text-[22px] font-bold leading-snug ${INK}`}>{card.title || "여행 엽서"}</h2>
          <p className={`mt-0.5 text-[12px] ${MUTED}`}>
            {[when, card.senderName].filter(Boolean).join(" · ")}
          </p>
          {card.greeting && (
            <p className={`mt-[4mm] line-clamp-6 rounded-lg bg-[#f4f4f6] px-3 py-2 text-[13px] leading-relaxed ${INK}`}>{card.greeting}</p>
          )}
          {card.places.length > 0 && (
            <p className={`mt-[3mm] line-clamp-2 text-[11px] leading-relaxed ${MUTED}`}>{card.places.map((place) => place.placeName).join(" · ")}</p>
          )}
          {/* 사진 칸은 쪽에 남은 높이를 2열×3줄로 나눈다 — 제목·인사말이 길어도 아래 줄이 쪽 밖으로 잘리지 않는다. */}
          {first.length > 0 && (
            <div className="mt-[4mm] grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-1.5">
              {first.map((file) => (
                <div key={file} className="min-h-0 overflow-hidden rounded-md bg-[#f4f4f6]">
                  <Photo id={card.id} file={file} className="" />
                </div>
              ))}
            </div>
          )}
        </Page>
      ),
    });
    if (rest.length > 0) {
      pages.push({
        kind: "trip-more",
        node: (no) => (
          <Page kind="trip-more" no={no}>
            <p className={`text-[11px] ${MUTED}`}>{card.title || "여행 엽서"} · 이어서</p>
            <div className="mt-[3mm] mb-[8mm] grid min-h-0 flex-1 grid-cols-3 grid-rows-5 gap-1.5">
              {rest.map((file) => (
                <div key={file} className="min-h-0 overflow-hidden rounded-md bg-[#f4f4f6]">
                  <Photo id={card.id} file={file} className="" />
                </div>
              ))}
            </div>
          </Page>
        ),
      });
    }
  }

  pages.push({
    kind: "last",
    node: (no) => (
      <Page kind="last" no={no}>
        <div className="my-auto flex flex-col items-center gap-2 text-center">
          <p className={`text-[20px] font-bold ${INK}`}>{year}년, 같이 다녀온 이야기</p>
          <p className={`text-[12px] ${MUTED}`}>내 여행 스케치 · 가족 책장</p>
        </div>
      </Page>
    ),
  });

  return (
    <main className="book-main mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-16 pt-8">
      {/* 쪽 크기와 인쇄 규칙. 이 화면이 열려 있는 동안에만 인쇄 설정에 들어간다. */}
      <style>{`
        @page { size: A5 portrait; margin: 0; }
        .book-page { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          html, body { background: #fff !important; }
          /* 사파리는 flex·grid 안에 든 것의 쪽 나누기(break-after)를 지키지 않아 쪽이 두 장에 걸쳐 어긋난다.
             인쇄할 때는 쪽을 감싸는 상자들을 일반(block) 상자로 되돌리고, 쪽을 가운데에 둔다. */
          .book-main { display: block !important; min-height: 0 !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .book-zoom { display: block !important; zoom: 1 !important; }
          .book-page {
            display: flex !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .book-page:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      {preview && (
        <div className="print:hidden">
          <PreviewBanner />
        </div>
      )}
      <Link href={back} className="self-start text-[18px] font-semibold text-accent print:hidden">
        ← 올해의 책으로
      </Link>

      <section aria-label="저장하는 법" className="flex flex-col gap-3 rounded-2xl bg-bg-subtle p-4 print:hidden">
        <h2 className="text-[18px] font-bold text-text">책으로 저장하기</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-text-muted">
          <li>사진을 다 불러오면 아래 [PDF로 저장]이 켜져요.</li>
          <li>
            인쇄 창에서 프린터를 &lsquo;PDF로 저장&rsquo;으로 고르세요. 용지는 A5, 여백은 &lsquo;없음&rsquo;, &lsquo;머리글 및 바닥글&rsquo;은 끄는 것이 좋아요(끄지
            않으면 쪽 위아래에 주소와 날짜가 찍혀요).
          </li>
          <li>
            PC 크롬·엣지에서 하는 것을 권해요. 폰은 공유 → 인쇄(아이폰은 인쇄 미리보기를 두 손가락으로 벌리면 PDF)인데, 아이폰은 용지가 A4로 잡히고
            주소·날짜 줄을 끌 수 없어요.
          </li>
        </ol>
        <p className="text-[13px] leading-relaxed text-text-faint">
          사진은 책장에 있는 크기(약 640px)라 가족용 기념 PDF에 알맞아요. 전문 인쇄소에 맡길 만큼 또렷하지는 않아요.
        </p>
        <button
          type="button"
          disabled={!ready}
          onClick={() => window.print()}
          className="min-h-14 rounded-2xl bg-accent px-5 text-[18px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
        >
          {label}
        </button>
      </section>

      <div ref={rootRef} className="book-zoom flex flex-col items-center gap-4" style={{ zoom }}>
        {/* 쪽 바로 아래에 감싸는 상자를 두지 않는다 — 인쇄 규칙의 :last-child(마지막 쪽 뒤에 빈 쪽이 안 생기게)가 쪽 자신을 가리켜야 한다. */}
        {pages.map((page, index) => (
          <Fragment key={`${page.kind}-${index}`}>{page.node(index === 0 ? undefined : index)}</Fragment>
        ))}
      </div>
    </main>
  );
}
