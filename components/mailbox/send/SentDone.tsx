"use client";

import { useEffect, useRef, useState } from "react";
import { attachParticle } from "@/lib/korean";
import { postcardUrl } from "@/lib/mailbox";
import { canShareLink, copiedNote, copyLink, shareCard } from "@/lib/shareLink";
import type { MailboxItem } from "@/lib/supabase/mailbox";

/*
  엽서를 만든 뒤.

  할 일은 하나 — 받는 분께 링크를 보내는 것이다. 책장마다 [카카오톡 등으로 보내기](폰의 공유창, 카카오톡이 목록에 나온다)와
  [링크 복사](공유창이 없는 브라우저)가 있다. 그리고 다음 일을 말해 둔다: 열어 보시면 여행 상세에서 알려 드린다.
*/

interface SentDoneProps {
  postcardId: string;
  /** 보낸 이름(받는 분께 ‘○○이 보낸 엽서’로 보인 것). */
  senderName: string;
  /** 엽서가 간 책장과, 그 책장에 보인 글(호칭 포함). */
  boxes: { box: MailboxItem; greeting: string }[];
  onClose: () => void;
}

/** "누가 열어 보시면" — 책장이 하나면 그 분들, 여럿이면 받는 분들. */
function whoOpens(boxes: SentDoneProps["boxes"]): string {
  if (boxes.length !== 1) return "받는 분들이";
  const name = boxes[0].box.greetingName?.trim();
  return name ? attachParticle(name, "이", "가") : "받는 분이";
}

export function SentDone({ postcardId, senderName, boxes, onClose }: SentDoneProps) {
  const [note, setNote] = useState<string | null>(null);
  // 단추가 사라지고 새 걸음이 나타나면 초점이 갈 곳을 잃는다 — 제목으로 옮겨 화면 낭독기가 새 걸음을 읽게 한다.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const linkOf = (box: MailboxItem) => postcardUrl(window.location.origin, box.token, postcardId);
  const canShare = canShareLink();

  // 공유창·복사는 여행 상세에서 다시 보낼 때와 같은 규칙이다(lib/shareLink).
  const share = (box: MailboxItem, greeting: string) => shareCard({ senderName, greeting, url: linkOf(box) });

  const copy = async (box: MailboxItem) => {
    const url = linkOf(box);
    setNote(copiedNote(await copyLink(url), box.name, url));
  };

  return (
    <>
      {/* 오른쪽 위의 ✕ 를 피해 제목만 오른쪽을 비운다. */}
      <div className="pr-9">
        <h2 ref={heading} tabIndex={-1} className="text-[20px] font-bold tracking-tight text-text outline-none">
          엽서를 만들었어요
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-text-muted">
          이제 받는 분께 링크를 보내 주세요. 링크를 열면 로그인 없이 엽서를 볼 수 있어요.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {boxes.map(({ box, greeting }) => (
          <li key={box.id} className="flex flex-col gap-2 rounded-xl bg-bg-subtle p-3.5">
            <p className="text-[15px] font-semibold text-text">{box.name}</p>
            <p className="break-keep text-[13px] leading-relaxed text-text-muted">&ldquo;{greeting}&rdquo;</p>
            <div className="flex flex-wrap gap-2">
              {canShare && (
                <button
                  type="button"
                  onClick={() => void share(box, greeting)}
                  className="rounded-full bg-[#fee500] px-4 py-2 text-[14px] font-medium text-[#1d1d1f]"
                >
                  카카오톡 등으로 보내기
                </button>
              )}
              <button
                type="button"
                onClick={() => void copy(box)}
                className="rounded-full bg-bg px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line hover:bg-line"
              >
                링크 복사
              </button>
            </div>
          </li>
        ))}
      </ul>

      {note && (
        <p role="status" className="break-all rounded-xl bg-bg-subtle px-4 py-3 text-[13px] text-text-muted">
          {note}
        </p>
      )}

      <p className="break-keep text-[13px] leading-relaxed text-text-muted">
        {whoOpens(boxes)} 열어 보시면 여행 상세에서 알려 드려요. 엽서는 지금 모습으로 남고, 이 여행을 지우면 엽서도 함께
        지워져요.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent hover:bg-accent-hover"
      >
        닫기
      </button>
    </>
  );
}
