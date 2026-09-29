"use client";

import { useState } from "react";

/*
  여행 100선 상세 페이지를 링크로 보내기.

  이 페이지는 누구나 열 수 있는 공개 페이지라 따로 베껴 두거나 만들 것이
  없다 — 주소를 건네면 된다. 폰에서는 공유 창(카톡 등)을 열고, 공유 창이
  없는 브라우저(컴퓨터)에서는 주소를 복사한다.

  현재 주소를 그대로 쓰지 않는다. 목록에서 넘어올 때 붙는 검색·필터 조각이
  받는 사람에게 딸려 가면 안 되므로, 이 곳의 대표 주소만 건넨다.
*/

interface ShareSpotButtonProps {
  spotId: string;
  spotName: string;
  /** 링크 미리보기 글. */
  summary: string;
}

type Notice = "copied" | "failed" | null;

export function ShareSpotButton({ spotId, spotName, summary }: ShareSpotButtonProps) {
  const [notice, setNotice] = useState<Notice>(null);

  const say = (next: Notice) => {
    setNotice(next);
    window.setTimeout(() => setNotice(null), 2500);
  };

  const share = async () => {
    const url = `${window.location.origin}/spots/${encodeURIComponent(spotId)}`;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: spotName, text: summary, url });
      } catch {
        // 공유 창을 닫은 것뿐이다.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      say("copied");
    } catch {
      say("failed");
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        aria-label={`${spotName} 링크 공유`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-bg-subtle px-4 py-2 text-[14px] font-medium text-text transition hover:bg-line"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
          <path
            d="M12 3v12M12 3l-4 4M12 3l4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        링크 공유
      </button>
      <span role="status" className="text-[13px] text-text-muted">
        {notice === "copied" && "주소를 복사했어요"}
        {notice === "failed" && "복사하지 못했어요. 주소창의 주소를 복사해 주세요."}
      </span>
    </span>
  );
}
