"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

interface LoginButtonProps {
  /** 로그인을 마치고 돌아올 곳. */
  next?: string;
}

// 카카오 브랜드 색. 남의 로고 색이라 테마 토큰을 쓰지 않는다.
const KAKAO_YELLOW = "#FEE500";
const KAKAO_BROWN = "#191600";

export function LoginButton({ next = "/" }: LoginButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const signIn = async () => {
    const supabase = getBrowserClient();
    if (!supabase) {
      setFailed(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setBusy(false);
      setFailed(true);
    }
    // 성공하면 카카오로 넘어가므로 이 화면은 곧 사라진다.
  };

  if (failed) {
    return <p className="text-[14px] text-text-muted">지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.</p>;
  }

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition disabled:opacity-60"
      style={{ backgroundColor: KAKAO_YELLOW, color: KAKAO_BROWN }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor">
        <path d="M12 3C6.99 3 3 6.2 3 10.14c0 2.5 1.65 4.7 4.15 5.96l-.9 3.3c-.09.32.27.57.55.39l3.94-2.6c.41.04.83.06 1.26.06 5.01 0 9-3.2 9-7.11S17.01 3 12 3Z" />
      </svg>
      {busy ? "카카오로 이동 중…" : "카카오로 시작하기"}
    </button>
  );
}
