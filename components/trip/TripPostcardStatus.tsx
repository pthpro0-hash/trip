"use client";

import { useState, useSyncExternalStore } from "react";
import { attachParticle } from "@/lib/korean";
import { postcardUrl } from "@/lib/mailbox";
import { heartTarget, summarizeHearts } from "@/lib/mailboxHearts";
import { canShareLink, copiedNote, copyLink, shareCard } from "@/lib/shareLink";
import type { TripPostcardLine } from "@/lib/supabase/postcards";
import { groupReplies } from "@/lib/tripPostcards";

/*
  보낸 엽서는 열어 보셨을까, 뭐라고 하셨을까.

  엽서를 보내고 나면 궁금한 것은 하나다 — 부모님이 열어 보셨나, 뭐라고 하셨나. 예전에는 ‘내 정보 → 가족 책장’의 보낸 엽서
  목록을 열어야 알 수 있었다. 여행 상세의 공유 줄 아래에 받는 곳마다 한 줄(열어 보셨는지)과 그 아래에 부모님의 답장·하트를
  보여 준다. 아직 안 열어 보셨으면 [다시 보내기] — 같은 엽서 링크를 폰의 공유창(안 되는 브라우저는 링크 복사)으로 또 보낸다.
  보내지 않은 여행에는 아무것도 그리지 않는다.

  '새 답장'·'새 하트'는 이번에 처음 본 것(fresh)에만 붙는다. 보였다고 적는 일(위 띠의 새 소식 표시를 끄는 일)은 부르는 쪽이 한다.
*/

interface TripPostcardStatusProps {
  lines: TripPostcardLine[];
  /** 이번에 처음 본 답장·하트의 id. */
  fresh?: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();
/** 바뀌는 일이 없는 값(공유창이 있는가)을 읽는 구독 — 서버 그림과 어긋나도 React 가 맞춰 준다. */
const subscribeNothing = () => () => undefined;

function NewBadge({ children }: { children: string }) {
  return <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">{children}</span>;
}

function Line({ line, fresh }: { line: TripPostcardLine; fresh: ReadonlySet<string> }) {
  const [note, setNote] = useState<string | null>(null);
  const hearts = summarizeHearts(line.hearts);
  const replies = groupReplies(line.replies);
  // "엄마 아빠께" / 부르는 말이 없으면 "‘우리 집’에" — 따옴표로 묶어 어떤 이름에도 ‘에’가 자연스럽다.
  const to = line.greetingName ? `${line.greetingName}께` : `‘${line.name}’에`;
  const share = useSyncExternalStore(subscribeNothing, canShareLink, () => false);
  /*
    열어 보지 않으셨는데 반응이 있다면, 그것은 앞서 보낸 엽서에 남기신 것이다(이 줄은 가장 최근에 보낸 엽서 기준이라서). 위의
    '아직 안 열어 보셨어요'와 아래의 '좋구나 하셨어요'가 서로 모순처럼 보이지 않게 밝혀 둔다.
  */
  const fromEarlier = !line.opened && (replies.length > 0 || hearts.length > 0);

  const resend = async () => {
    const url = postcardUrl(window.location.origin, line.token, line.postcardId);
    if (share) {
      // 창을 그냥 닫은 것은 끝이다. 창이 열리지 못했다면(공유창이 있다면서 막는 웹뷰 등) 링크 복사로 이어 간다 — 눌러도 아무 일이
      // 없는 단추가 되지 않게.
      if ((await shareCard({ senderName: line.senderName, greeting: line.greeting, url })) !== "failed") return;
    }
    setNote(copiedNote(await copyLink(url), line.name, url));
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 break-keep">
          {`${to} 엽서를 보냈어요`}
          {" · "}
          {line.opened ? (
            <span className="font-medium text-accent">
              열어 보셨어요 <span aria-hidden="true">✓</span>
            </span>
          ) : (
            "아직 안 열어 보셨어요"
          )}
        </span>
        {!line.opened && (
          <button
            type="button"
            aria-label={`${to} 엽서 ${share ? "다시 보내기" : "링크 복사"}`}
            onClick={() => void resend()}
            className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-2 text-[13px] font-medium text-text ring-1 ring-line transition hover:bg-line"
          >
            {share ? "다시 보내기" : "링크 복사"}
          </button>
        )}
      </div>

      {fromEarlier && <p className="pl-3 text-[12px] text-text-faint">지난 엽서에 남기신 반응이에요</p>}
      {replies.map((group) => (
        <p key={`${group.who}|${group.reaction}`} className="flex flex-wrap items-center gap-1.5 pl-3 text-[14px] text-text">
          {/* 아이콘 칸 폭을 같게 해 답장과 하트의 글이 같은 줄에서 시작한다. */}
          <span aria-hidden="true" className="inline-block w-5 text-center">
            💬
          </span>
          <span className="break-keep">
            {attachParticle(group.who, "이", "가")} &lsquo;{group.reaction}&rsquo; 하셨어요{group.count > 1 ? ` · ${group.count}번` : ""}
          </span>
          {group.ids.some((id) => fresh.has(id)) && <NewBadge>새 답장</NewBadge>}
        </p>
      ))}
      {hearts.map((entry) => (
        <p key={entry.who} className="flex flex-wrap items-center gap-1.5 pl-3 text-[14px] text-text">
          <span aria-hidden="true" className="inline-block w-5 text-center text-[#e0245e]">
            ♥
          </span>
          <span className="break-keep">
            {attachParticle(entry.who, "이", "가")} {heartTarget(entry)} 하트를 눌렀어요
          </span>
          {entry.ids.some((id) => fresh.has(id)) && <NewBadge>새 하트</NewBadge>}
        </p>
      ))}

      {note && (
        <p role="status" className="break-all rounded-xl bg-bg-subtle px-3 py-2 text-[13px] text-text-muted">
          {note}
        </p>
      )}
    </li>
  );
}

export function TripPostcardStatus({ lines, fresh = NONE }: TripPostcardStatusProps) {
  if (lines.length === 0) return null;

  return (
    // role="list": 점을 지운 목록은 사파리·VoiceOver 가 목록으로 읽지 않는 일이 있어 이름(보낸 엽서)까지 사라진다.
    <ul role="list" aria-label="보낸 엽서" className="flex w-full flex-col gap-2.5 text-[14px] text-text-muted">
      {lines.map((line) => (
        <Line key={line.mailboxId} line={line} fresh={fresh} />
      ))}
    </ul>
  );
}
