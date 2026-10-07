"use client";

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { toggleWish, type MailboxView, type WishResult } from "@/lib/supabase/mailboxPublic";
import { mailboxPath, type PreviewMode } from "@/lib/mailbox";
import { FONT_SCALE } from "@/lib/mailboxSettings";
import { withWish, wishedBy, type Wish } from "@/lib/mailboxWishes";
import { useWho } from "@/lib/mailboxWho";
import { REGIONS } from "@/lib/regions";
import { matchesQuery, sortByRelevance } from "@/lib/search";
import { spotById, wishSpots } from "@/lib/wishSpots";
import { PreviewBanner } from "./PreviewBanner";
import { WhoPicker } from "./WhoPicker";

/*
  가고 싶은 곳 보내기 — 부모님이 여행 100선에서 가고 싶은 곳을 골라 가족에게 보낸다.

  하트처럼 누르면 켜지고 한 번 더 누르면 꺼진다. 누르면 먼저 눌린 모양으로 바꾸고(느린 인터넷에서도 바로 반응하게),
  안 되면 되돌리고 이유를 말로 알린다. 이름을 모르면(여러 분이 쓰는 책장에서 아직 안 골랐으면) 먼저 고르게 한다.
  미리보기(보내는 사람)에서는 아무것도 보내지 않는다.
*/

const REASON_TEXT: Record<Exclude<WishResult, { ok: true }>["reason"], string> = {
  often: "너무 자주 눌렀어요. 잠시 뒤에 다시 눌러 주세요.",
  full: "가고 싶은 곳이 가득 찼어요(100곳). 하나를 빼면 다시 보낼 수 있어요.",
  off: "가고 싶은 곳 받기를 지금은 받지 않고 있어요.",
  closed: "이 책장은 지금 닫혀 있어요.",
  invalid: "보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.",
  failed: "보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.",
};

export function WishView({ token, view, preview = false }: { token: string; view: MailboxView; preview?: PreviewMode }) {
  const who = useWho(token);
  const [wishes, setWishes] = useState<Wish[]>(view.wishes);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("전체");
  const [message, setMessage] = useState<string | null>(null);
  /** 보내는 중인 곳. 같은 곳을 연달아 눌러도 한 번만 보낸다. */
  const pending = useRef(new Set<string>());

  const back = mailboxPath(token, preview);
  const scale = { "--rs": FONT_SCALE[view.settings.font] } as CSSProperties;
  // 받는 분 이름이 정해져 있지 않은 책장이면 "가족"으로 보낸다. 미리보기에서는 이름을 묻지 않는다.
  const name = preview ? "미리보기" : view.members.length === 0 ? "가족" : who || null;

  const shown = useMemo(() => {
    const inRegion = region === "전체" ? wishSpots : wishSpots.filter((spot) => spot.region === region);
    if (!query.trim()) return inRegion;
    return sortByRelevance(inRegion, query).filter((spot) => matchesQuery(spot, query));
  }, [query, region]);

  const press = async (spot: string) => {
    if (preview) {
      setMessage("미리보기라서 가고 싶은 곳은 보내지 않아요");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) return;
    if (!name) {
      setMessage("먼저 위에서 누구신지 골라 주세요.");
      return;
    }
    if (pending.current.has(spot)) return;
    const on = !wishedBy(wishes, name, spot);
    pending.current.add(spot);
    setMessage(null);
    setWishes((current) => withWish(current, name, spot, on));
    const result = await toggleWish(supabase, token, name, spot, on);
    pending.current.delete(spot);
    if (result.ok) return;
    setWishes((current) => withWish(current, name, spot, !on));
    setMessage(REASON_TEXT[result.reason]);
  };

  const shell = (children: ReactNode) => (
    <main style={scale} className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 pb-16 pt-8">
      {preview && <PreviewBanner />}
      <Link href={back} className="self-start rs-18 font-semibold text-accent">
        ← 책장
      </Link>
      {children}
    </main>
  );

  if (!view.settings.wish) {
    return shell(
      <header className="flex flex-col gap-2">
        <h1 className="rs-28 font-bold text-text">가고 싶은 곳 받기는 지금 쓰지 않고 있어요</h1>
        <p className="rs-18 leading-relaxed text-text-muted">보내는 가족이 이 기능을 꺼 두었어요. 책장에서 엽서는 그대로 볼 수 있어요.</p>
      </header>,
    );
  }

  return shell(
    <>
      <header className="flex flex-col gap-2">
        <h1 className="rs-32 font-bold tracking-tight text-text">가고 싶은 곳 보내기</h1>
        <p className="rs-18 leading-relaxed text-text-muted">가고 싶은 곳의 ♡를 누르면 가족에게 전해져요. 한 번 더 누르면 취소돼요.</p>
      </header>

      {!preview && <WhoPicker token={token} members={view.members} />}

      {message && (
        <p role="status" className="rounded-2xl bg-accent-soft px-4 py-3 rs-18 font-semibold text-accent">
          {message}
        </p>
      )}

      {wishes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="rs-22 font-bold text-text">보낸 곳 {wishes.length}곳</h2>
          <ul aria-label="보낸 곳" className="flex flex-col gap-1.5">
            {wishes.map((wish) => (
              <li key={`${wish.who}|${wish.spot}`} className="rs-18 text-text">
                <span className="font-semibold text-[#e0245e]">♥</span> {wish.who}: {spotById(wish.spot)?.name ?? wish.spot}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <input
          type="search"
          role="searchbox"
          aria-label="곳 찾기"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="곳 이름으로 찾기"
          className="min-h-14 rounded-2xl bg-bg-subtle px-4 rs-20 text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <div className="flex flex-wrap gap-2">
          {["전체", ...REGIONS].map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={region === entry}
              onClick={() => setRegion(entry)}
              className={`min-h-11 rounded-full px-4 rs-16 font-semibold transition ${
                region === entry ? "bg-text text-bg" : "bg-bg-subtle text-text-muted"
              }`}
            >
              {entry}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="rs-18 text-text-muted">찾는 곳이 없어요. 다른 이름으로 찾아 보세요.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {shown.map((spot) => {
              const mine = !!name && wishedBy(wishes, name, spot.id);
              const others = wishes.filter((wish) => wish.spot === spot.id).map((wish) => wish.who);
              return (
                <li key={spot.id} className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 ring-1 ring-line">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate rs-20 font-bold text-text">{spot.name}</span>
                      <span className="shrink-0 rounded-full bg-bg-subtle px-2 py-0.5 rs-14 text-text-muted">{spot.region}</span>
                    </span>
                    <span className="line-clamp-2 rs-16 leading-snug text-text-muted">{spot.summary}</span>
                    {others.length > 0 && <span className="rs-14 font-semibold text-[#e0245e]">♥ {others.join("·")}</span>}
                  </span>
                  <button
                    type="button"
                    aria-label={mine ? `${spot.name} 가고 싶은 곳에서 빼기` : `${spot.name} 가고 싶어요`}
                    aria-pressed={mine}
                    onClick={() => void press(spot.id)}
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-full rs-28 leading-none transition active:scale-95 ${
                      mine ? "bg-[#fde8ef] text-[#e0245e]" : "bg-bg-subtle text-text-muted"
                    }`}
                  >
                    <span aria-hidden="true">{mine ? "♥" : "♡"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link href={back} className="flex min-h-14 items-center justify-center rounded-2xl bg-bg-subtle rs-20 font-semibold text-text">
        책장으로 가기
      </Link>
    </>,
  );
}
