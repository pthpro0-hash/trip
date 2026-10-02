"use client";

import Link from "next/link";
import type { InboxCard, MailboxView } from "@/lib/supabase/mailboxPublic";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";
import { useWho } from "@/lib/mailboxWho";
import { WhoPicker } from "./WhoPicker";

/*
  우편함 첫 화면 — 부모님이 보는 곳.

  글씨는 크게(본문 18px 이상), 단추는 손가락 하나 크기로. 한 화면에 엽서 한 장씩 보이는 목록이고,
  할 수 있는 일은 "열어 보기"뿐이다. 설정·메뉴·계정은 없다. 새 엽서(아직 안 열어 본 것)가 먼저 눈에 띈다.
*/

const dayOf = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

function Card({ token, card }: { token: string; card: InboxCard }) {
  const cover = card.cover ? postcardFileUrl(card.id, card.cover) : null;
  const last = card.replies.at(-1);
  return (
    <li>
      <Link
        href={`/m/${token}/p/${card.id}`}
        className="flex items-center gap-4 rounded-3xl bg-surface p-3.5 ring-1 ring-line transition active:scale-[0.99]"
      >
        <span className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-bg-subtle">
          {cover ? (
            // 우리 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true" className="text-[28px]">
              ✉️
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[22px] font-bold leading-snug tracking-tight text-text">
              {card.title || "여행 엽서"}
            </span>
            {!card.opened && (
              <span className="shrink-0 rounded-full bg-[#e2661b] px-2.5 py-0.5 text-[14px] font-bold text-white">새 엽서</span>
            )}
          </span>
          <span className="text-[17px] text-text-muted">
            {card.senderName} · {dayOf(card.sentAt) || card.startedOn}
          </span>
          {last && (
            <span className="truncate text-[16px] text-accent">
              {last.who}: {last.reaction}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function MailboxHome({ token, view }: { token: string; view: MailboxView }) {
  const who = useWho(token);
  const fresh = view.postcards.filter((card) => !card.opened).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-5 pb-16 pt-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold tracking-tight text-text">우리 가족 우편함</h1>
        <p className="text-[18px] leading-relaxed text-text-muted">
          {view.postcards.length === 0
            ? "아직 도착한 엽서가 없어요. 가족이 여행을 다녀오면 이곳으로 엽서가 와요."
            : fresh > 0
              ? `새 엽서가 ${fresh}장 도착했어요.`
              : `받은 엽서 ${view.postcards.length}장`}
        </p>
        {who && <WhoPicker token={token} members={view.members} compact />}
      </header>

      <WhoPicker token={token} members={view.members} />

      {view.postcards.length > 0 && (
        <ul className="flex flex-col gap-3.5" aria-label="받은 엽서">
          {view.postcards.map((card) => (
            <Card key={card.id} token={token} card={card} />
          ))}
        </ul>
      )}

      <section className="mt-auto rounded-2xl bg-bg-subtle p-5 text-[16px] leading-relaxed text-text-muted">
        <p className="font-semibold text-text">홈 화면에 두면 편해요</p>
        <p className="mt-1">
          아이폰은 아래 가운데 공유 단추를 누르고 &lsquo;홈 화면에 추가&rsquo;, 안드로이드는 위 메뉴(점 세 개)에서
          &lsquo;홈 화면에 추가&rsquo;를 누르세요. 다음부터는 아이콘 하나로 바로 열려요.
        </p>
      </section>
    </main>
  );
}
