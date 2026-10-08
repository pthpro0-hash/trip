"use client";

import type { ReactNode } from "react";
import { HubDialog } from "@/components/hub/HubDialog";

/*
  공유 — 무엇을 어떻게 보낼지 고르는 시트.

  여행 상세의 공유는 "링크 공유"와 "엽서 보내기" 두 단추였다. 이름만 봐서는 무엇이 누구에게 가는지 알기 어렵다.
  단추를 "공유" 하나로 합치고, 누르면 아래에서 올라오는 이 시트에서 고른다 — 각각 누구에게 어떻게 가는지를 한 줄씩 적어서.
  고른 뒤 열리는 창은 그대로다(링크 창 TripShareDialog, 엽서 창 SendPostcardDialog). 들어가는 길만 하나로 합쳤다.

  엽서에 실리는 사진 수는 여기서 말하지 않는다 — 얼마나 싣는지는 엽서 창이 정하고 바뀔 수 있다.
*/

interface ShareChooserProps {
  /** 공유할 여행의 이름. */
  title: string;
  /** "링크로 보여 주기"를 골랐다. */
  onLink: () => void;
  /** "부모님께 엽서 보내기"를 골랐다. */
  onPostcard: () => void;
  onClose: () => void;
}

function Option({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl p-4 text-left ring-1 ring-line transition hover:bg-bg-subtle"
    >
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[16px] font-semibold text-text">{title}</span>
        <span className="mt-0.5 block break-keep text-[14px] leading-relaxed text-text-muted">{hint}</span>
      </span>
    </button>
  );
}

const ICON = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ShareChooser({ title, onLink, onPostcard, onClose }: ShareChooserProps) {
  return (
    <HubDialog label={`${title} 공유하기`} onClose={onClose}>
      {/* 오른쪽 위는 창의 닫기 단추 자리다. */}
      <div className="flex flex-col gap-4 pr-8">
        <h2 className="text-[20px] font-bold tracking-tight text-text">{title} 공유하기</h2>
        <div className="flex flex-col gap-3">
          <Option
            icon={
              <svg {...ICON}>
                <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
                <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
              </svg>
            }
            title="링크로 보여 주기"
            hint="링크를 아는 사람은 이 여행 하나를 사진까지 볼 수 있어요"
            onClick={onLink}
          />
          <Option
            icon={
              <svg {...ICON}>
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
                <path d="M4 7l8 6 8-6" />
              </svg>
            }
            title="부모님께 엽서 보내기"
            hint="부모님께 사진과 한 줄이 엽서로 도착해요"
            onClick={onPostcard}
          />
        </div>
      </div>
    </HubDialog>
  );
}
