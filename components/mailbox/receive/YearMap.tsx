"use client";

import { useMemo } from "react";
import type { InboxCard } from "@/lib/supabase/mailboxPublic";
import { tripsPerMonth } from "@/lib/footprint";
import { yearPhotoUrls, yearSteps, yearTotals } from "@/lib/mailboxShelf";
import { FootprintPlayer } from "@/components/sketch/FootprintPlayer";

/*
  그해 책들에서 다녀온 곳을 날짜순으로 지도에 찍어 본다.

  한장 요약의 '발자취'를 그대로 쓴다. 링크로 받은 모양(shared)이라 점을 눌러도 갈 곳이 없고, 책 한 권을 한
  여행으로 센다. 지도는 무거워서 단추를 눌렀을 때만 불러온다(MailboxHome 이 동적으로 가져온다).
*/
export function YearMap({ year, cards }: { year: string; cards: InboxCard[] }) {
  const steps = useMemo(() => yearSteps(cards), [cards]);
  const photoUrls = useMemo(() => yearPhotoUrls(cards), [cards]);
  return (
    <FootprintPlayer
      shared
      steps={steps}
      monthCounts={tripsPerMonth(steps)}
      totals={yearTotals(cards, steps)}
      photoUrls={photoUrls}
      heading={`${year}년 다녀온 곳`}
      showMonths
    />
  );
}
