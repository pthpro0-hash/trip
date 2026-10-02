"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  markPostcardOpened,
  postcardFileUrl,
  replyToPostcard,
  type Reply,
  type ReceivedPostcard,
} from "@/lib/supabase/mailboxPublic";
import { DEFAULT_REACTIONS, postcardSpan, postcardSteps, postcardTitle } from "@/lib/mailbox";
import { keepWho, useWho } from "@/lib/mailboxWho";
import { FootprintPlayer } from "@/components/sketch/FootprintPlayer";
import { WhoPicker } from "./WhoPicker";

/*
  엽서 한 장 — 부모님이 링크를 누르면 바로 보이는 화면.

  로그인도 설정도 없다. 큰 사진, 큰 글씨, 보낸 사람의 인사말, 다녀온 길(지도), 그리고 답장 단추.
  사진이 지워졌으면(보낸 분이 원본을 지우면 복사본도 지워진다) 그 자리에 부드러운 안내를 둔다.
  화면을 연 뒤에 "열어 봤다"고 적는다(미리보기 기계가 링크를 읽어 가도 찍히지 않게).
*/

function Photo({ postcardId, file }: { postcardId: string; file: string }) {
  const [gone, setGone] = useState(false);
  if (gone) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-3xl bg-bg-subtle px-6 text-center text-[17px] leading-relaxed text-text-muted">
        보낸 분이 이 사진을 지웠어요
      </div>
    );
  }
  return (
    // 우리 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={postcardFileUrl(postcardId, file)}
      alt=""
      loading="lazy"
      onError={() => setGone(true)}
      className="w-full rounded-3xl bg-bg-subtle object-cover"
    />
  );
}

export function ReceivedPostcardView({ token, card }: { token: string; card: ReceivedPostcard }) {
  const who = useWho(token);
  const [replies, setReplies] = useState<Reply[]>(card.replies);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { snapshot } = card;

  // 사람이 화면을 연 뒤에 한 번, 열어 봤다고 적는다.
  useEffect(() => {
    const supabase = getBrowserClient();
    if (supabase) void markPostcardOpened(supabase, token, card.id);
  }, [token, card.id]);

  const steps = useMemo(() => postcardSteps(snapshot), [snapshot]);
  const photoUrls = useMemo(
    () => new Map(snapshot.files.map((file) => [file, postcardFileUrl(card.id, file)] as const)),
    [snapshot.files, card.id],
  );

  // 받는 분 이름이 정해져 있지 않은 우편함이면 "가족"으로 답한다.
  const name = card.members.length === 0 ? "가족" : who || null;

  const reply = async (reaction: string) => {
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

  const photos = snapshot.files;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-20 pt-6">
      <p className="text-[18px] font-semibold text-accent">{card.senderName}이(가) 보낸 여행 엽서</p>

      {photos.length > 0 && (
        <div className="flex flex-col gap-3">
          {photos.map((file) => (
            <Photo key={file} postcardId={card.id} file={file} />
          ))}
        </div>
      )}

      <header className="flex flex-col gap-1.5">
        <h1 className="text-[32px] font-bold leading-snug tracking-tight text-text">{postcardTitle(snapshot)}</h1>
        <p className="text-[18px] text-text-muted">{postcardSpan(snapshot)}</p>
      </header>

      {card.greeting && (
        <blockquote className="rounded-3xl bg-bg-subtle px-6 py-5 text-[22px] leading-relaxed text-text">
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

      <section aria-label="답장하기" className="flex flex-col gap-3 rounded-3xl bg-accent-soft p-5">
        <h2 className="text-[22px] font-bold text-text">답장하기</h2>

        {!name ? (
          <WhoPicker token={token} members={card.members} />
        ) : (
          <>
            {card.members.length > 0 && (
              <p className="text-[16px] text-text-muted">
                <span className="font-semibold text-text">{name}</span>(으)로 답장해요.{" "}
                <button type="button" onClick={() => keepWho(token, "")} className="font-medium text-accent underline underline-offset-4">
                  바꾸기
                </button>
              </p>
            )}
            <div className="flex flex-col gap-3">
              {DEFAULT_REACTIONS.map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  disabled={sending !== null}
                  onClick={() => void reply(reaction)}
                  className="min-h-16 rounded-2xl bg-accent px-5 text-[22px] font-semibold text-on-accent transition active:scale-[0.99] disabled:opacity-60"
                >
                  {sending === reaction ? "보내는 중…" : reaction}
                </button>
              ))}
            </div>
          </>
        )}

        {message && (
          <p role="status" className="text-[18px] font-semibold text-accent">
            {message}
          </p>
        )}

        {replies.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-line pt-3" aria-label="보낸 답장">
            {replies.map((entry, index) => (
              <li key={index} className="text-[18px] text-text">
                <span className="font-semibold">{entry.who}</span>: {entry.reaction}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href={`/m/${token}`}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-bg-subtle text-[20px] font-semibold text-text"
      >
        우편함으로 가기
      </Link>
    </main>
  );
}
