"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import type { AuthProvider, ProviderId } from "@/lib/auth/providers";
import { ProviderIcon } from "./ProviderIcon";

interface LoginButtonsProps {
  providers: AuthProvider[];
  /** 로그인을 마치고 돌아올 곳. */
  next?: string;
}

/*
  로그인 수단을 늘리고 줄이는 일이 앞으로도 있을 것이라, 버튼 하나하나를
  따로 만들지 않고 목록을 받아 그린다.

  동의항목을 미리 등록해야 하는 카카오 같은 경우가 있어서, 어떤 수단을
  쓸 수 있는지는 코드가 아니라 Supabase 설정이 정한다
  (lib/auth/enabledProviders.ts).
*/
export function LoginButtons({ providers, next = "/" }: LoginButtonsProps) {
  const [pending, setPending] = useState<ProviderId | null>(null);
  const [failed, setFailed] = useState(false);

  const signIn = async (provider: AuthProvider) => {
    const supabase = getBrowserClient();
    if (!supabase) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setPending(provider.id);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider.id,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setPending(null);
      setFailed(true);
    }
    // 성공하면 그 서비스로 넘어가므로 이 화면은 곧 사라진다.
  };

  if (providers.length === 0) {
    return (
      <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
        로그인 설정이 아직 끝나지 않았어요.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          onClick={() => signIn(provider)}
          disabled={pending !== null}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition disabled:opacity-60"
          style={{
            backgroundColor: provider.background,
            color: provider.foreground,
            boxShadow: provider.border ? `inset 0 0 0 1px ${provider.border}` : undefined,
          }}
        >
          <ProviderIcon id={provider.id} />
          {pending === provider.id ? "이동 중…" : provider.label}
        </button>
      ))}

      {failed && (
        <p className="text-[14px] text-text-muted">
          지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
