"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  markPostcardOpened,
  postcardFileUrl,
  replyToPostcard,
  toggleHeart,
  type HeartResult,
  type Reply,
  type ReceivedPostcard,
} from "@/lib/supabase/mailboxPublic";
import { mailboxPath, postcardSpan, postcardSteps, postcardTitle } from "@/lib/mailbox";
import { heartCount, heartedBy, heartNames, withHeart, type Heart } from "@/lib/mailboxHearts";
import { FONT_SCALE } from "@/lib/mailboxSettings";
import { keepWho, useWho } from "@/lib/mailboxWho";
import { FootprintPlayer } from "@/components/sketch/FootprintPlayer";
import { PhotoAlbum, type AlbumHearts } from "./PhotoAlbum";
import { PreviewBanner } from "./PreviewBanner";
import { WhoPicker } from "./WhoPicker";

/*
  엽서 한 장 — 부모님이 링크를 누르면 바로 보이는 화면.

  로그인도 설정도 없다. 큰 사진, 큰 글씨, 보낸 사람의 인사말, 다녀온 길(지도), 그리고 답장 단추.
  사진이 지워졌으면(보낸 분이 원본을 지우면 복사본도 지워진다) 그 자리에 부드러운 안내를 둔다.
  화면을 연 뒤에 "열어 봤다"고 적는다(미리보기 기계가 링크를 읽어 가도 찍히지 않게).
*/

/**
 * preview: 보내는 사람이 부모님 화면을 미리 보는 중. 열어 봤다는 표시도, 답장도, 하트도 보내지 않는다 —
 * 부모님이 안 보셨는데 "열어 보셨어요"가 찍히거나 보내는 사람의 답장이 부모님 것으로 남으면 안 된다.
 */
export function ReceivedPostcardView({ token, card, preview = false }: { token: string; card: ReceivedPostcard; preview?: boolean }) {
  const who = useWho(token);
  const [replies, setReplies] = useState<Reply[]>(card.replies);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Heart[]>(card.hearts);
  const [heartMessage, setHeartMessage] = useState<string | null>(null);
  /** 보내는 중인 하트(사진 파일, 책 하트는 빈 글자). 같은 곳을 연달아 눌러도 한 번만 보낸다. */
  const pending = useRef(new Set<string>());
  const { snapshot } = card;

  // 사람이 화면을 연 뒤에 한 번, 열어 봤다고 적는다.
  useEffect(() => {
    if (preview) return;
    const supabase = getBrowserClient();
    if (supabase) void markPostcardOpened(supabase, token, card.id);
  }, [token, card.id, preview]);

  const steps = useMemo(() => postcardSteps(snapshot), [snapshot]);
  const photoUrls = useMemo(
    () => new Map(snapshot.files.map((file) => [file, postcardFileUrl(card.id, file)] as const)),
    [snapshot.files, card.id],
  );

  // 받는 분 이름이 정해져 있지 않은 우편함이면 "가족"으로 답한다. 미리보기에서는 이름을 묻지 않는다.
  const name = preview ? "미리보기" : card.members.length === 0 ? "가족" : who || null;

  const reply = async (reaction: string) => {
    if (preview) {
      setMessage("미리보기라서 답장은 보내지 않아요");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase || !name) return;
    setMessage(null);
    setSending(reaction);
    const result = await replyToPostcard(supabase, token, card.id, name, reaction);
    setSending(null);
    if (result.ok) {
      setReplies((current) => [...current, { who: name, reaction }]);
      setMessage("답장을 보냈어요");
      return;
    }
    setMessage(
      result.reason === "often"
        ? "답장을 너무 자주 보냈어요. 잠시 뒤에 다시 눌러 주세요."
        : result.reason === "closed"
          ? "이 우편함은 지금 닫혀 있어요."
          : "답장을 보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.",
    );
  };

  /*
    하트를 켜고 끈다. 누르면 먼저 눌린 모양으로 바꾸고(느린 인터넷에서도 바로 반응하게), 안 되면 되돌리고
    이유를 말로 알린다. 이름을 모르면(여러 분이 쓰는 우편함에서 아직 안 골랐으면) 먼저 고르게 한다.
  */
  const heartText: Record<Exclude<HeartResult, { ok: true }>["reason"], string> = {
    often: "하트를 너무 자주 눌렀어요. 잠시 뒤에 다시 눌러 주세요.",
    closed: "이 우편함은 지금 닫혀 있어요.",
    changed: "하트 방식이 바뀌었어요. 화면을 다시 열어 주세요.",
    invalid: "하트를 보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.",
    failed: "하트를 보내지 못했어요. 잠시 뒤에 다시 눌러 주세요.",
  };
  const heart = async (file: string) => {
    if (preview) {
      setHeartMessage("미리보기라서 하트는 보내지 않아요");
      return;
    }
    const supabase = getBrowserClient();
    if (!supabase) return;
    if (!name) {
      setHeartMessage("먼저 아래에서 누구신지 골라 주세요.");
      document.getElementById("reply-section")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    if (pending.current.has(file)) return;
    const on = !heartedBy(hearts, name, file);
    pending.current.add(file);
    setHeartMessage(null);
    setHearts((current) => withHeart(current, name, file, on));
    const result = await toggleHeart(supabase, token, card.id, name, file, on);
    pending.current.delete(file);
    if (result.ok) return;
    setHearts((current) => withHeart(current, name, file, !on));
    setHeartMessage(heartText[result.reason]);
  };

  const photos = snapshot.files;
  const perPhoto = card.settings.heart === "photo";
  const albumHearts: AlbumHearts | undefined = perPhoto
    ? {
        mine: (file) => !!name && heartedBy(hearts, name, file),
        count: (file) => heartCount(hearts, file),
        onToggle: (file) => void heart(file),
      }
    : undefined;
  const bookMine = !!name && heartedBy(hearts, name, "");
  const bookNames = heartNames(hearts, "");

  return (
    <main
      style={{ "--rs": FONT_SCALE[card.settings.font] } as CSSProperties}
      className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-20 pt-6"
    >
      {preview && <PreviewBanner />}

      <p className="rs-18 font-semibold text-accent">{card.senderName}이(가) 보낸 여행 엽서</p>

      <PhotoAlbum postcardId={card.id} files={photos} hearts={albumHearts} />

      {!perPhoto && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label={bookMine ? "이 여행 하트 빼기" : "이 여행에 하트"}
            aria-pressed={bookMine}
            onClick={() => void heart("")}
            className={`flex min-h-16 items-center justify-center gap-3 rounded-2xl rs-22 font-semibold transition active:scale-[0.99] ${
              bookMine ? "bg-[#fde8ef] text-[#e0245e]" : "bg-bg-subtle text-text"
            }`}
          >
            <span aria-hidden="true" className="rs-28 leading-none">
              {bookMine ? "♥" : "♡"}
            </span>
            <span aria-hidden="true">{bookMine ? "하트를 눌렀어요" : "이 여행이 좋아요"}</span>
          </button>
          {bookNames.length > 0 && (
            <p className="text-center rs-16 text-text-muted">
              <span aria-hidden="true" className="text-[#e0245e]">
                ♥
              </span>{" "}
              <span>{bookNames.join(", ")}</span>
            </p>
          )}
        </div>
      )}

      {heartMessage && (
        <p role="status" className="rs-18 font-semibold text-accent">
          {heartMessage}
        </p>
      )}

      <header className="flex flex-col gap-1.5">
        <h1 className="rs-32 font-bold leading-snug tracking-tight text-text">{postcardTitle(snapshot)}</h1>
        <p className="rs-18 text-text-muted">{postcardSpan(snapshot)}</p>
      </header>

      {card.greeting && (
        <blockquote className="rounded-3xl bg-bg-subtle px-6 py-5 rs-22 leading-relaxed text-text">
          {card.greeting}
        </blockquote>
      )}

      {steps.length > 0 && (
        <FootprintPlayer
          shared
          steps={steps}
          monthCounts={Array.from({ length: 12 }, () => 0)}
          totals={{ trips: 1, places: steps.length, photos: steps.reduce((sum, step) => sum + step.photoCount, 0) }}
          photoUrls={photoUrls}
          heading="다녀온 길"
          hint="곳을 하나씩 찍어 봐요"
          showMonths={false}
        />
      )}

      <section id="reply-section" aria-label="답장하기" className="flex flex-col gap-3 rounded-3xl bg-accent-soft p-5">
        <h2 className="rs-22 font-bold text-text">답장하기</h2>

        {!name ? (
          <WhoPicker token={token} members={card.members} />
        ) : (
          <>
            {card.members.length > 0 && !preview && (
              <p className="rs-16 text-text-muted">
                <span className="font-semibold text-text">{name}</span>(으)로 답장해요.{" "}
                <button type="button" onClick={() => keepWho(token, "")} className="font-medium text-accent underline underline-offset-4">
                  바꾸기
                </button>
              </p>
            )}
            <div className="flex flex-col gap-3">
              {card.settings.words.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  disabled={sending !== null}
                  onClick={() => void reply(reaction)}
                  className="min-h-16 rounded-2xl bg-accent px-5 rs-22 font-semibold text-on-accent transition active:scale-[0.99] disabled:opacity-60"
                >
                  {sending === reaction ? "보내는 중…" : reaction}
                </button>
              ))}
            </div>
          </>
        )}

        {message && (
          <p role="status" className="rs-18 font-semibold text-accent">
            {message}
          </p>
        )}

        {replies.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-line pt-3" aria-label="보낸 답장">
            {replies.map((entry, index) => (
              <li key={index} className="rs-18 text-text">
                <span className="font-semibold">{entry.who}</span>: {entry.reaction}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={mailboxPath(token, preview)}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-bg-subtle rs-20 font-semibold text-text"
      >
        우편함으로 가기
      </Link>
    </main>
  );
}
