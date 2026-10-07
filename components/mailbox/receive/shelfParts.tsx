"use client";

import { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import type { InboxCard } from "@/lib/supabase/mailboxPublic";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";

/*
  책꽂이(MailboxHome)와 올해의 책(YearBookView)이 함께 쓰는 조각들.
*/

/** 지도는 무거워서 단추를 눌렀을 때(또는 지도가 꼭 필요한 화면에서만) 불러온다. 부모님 폰의 데이터를 아낀다. */
export const YearMap = dynamic(() => import("./YearMap").then((module) => module.YearMap), {
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
export function useToday(): string {
  return useSyncExternalStore(noSubscribe, todayKey, () => "");
}

/** 보낸 때를 "10월 2일"로. */
export const sentDay = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

/** 다녀온 날("2026-09-13")을 글자 그대로 읽는다. new Date 로 읽으면 시간대에 따라 하루가 밀린다. */
export const tripDay = (day: string, withYear = false) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return "";
  const text = `${Number(match[2])}월 ${Number(match[3])}일`;
  return withYear ? `${match[1]}년 ${text}` : text;
};

/** 책 표지. 그림이 없으면 편지 그림. */
export function Cover({ card, className }: { card: InboxCard; className: string }) {
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
