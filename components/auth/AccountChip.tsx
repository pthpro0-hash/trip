"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { writeCollections } from "@/lib/collections";

interface Account {
  name: string;
  avatar?: string;
}

/** 지금 누구로 들어와 있는지, 그리고 나가는 길. */
export function AccountChip() {
  const [account, setAccount] = useState<Account | null>(null);
  // 로그인 설정이 아예 없으면 기다릴 것도 없다. 효과 안에서 setState 하지
  // 않도록 처음 값으로 정한다.
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    const apply = (user: { user_metadata?: Record<string, unknown>; email?: string } | null) => {
      if (!active) return;
      setReady(true);
      if (!user) {
        setAccount(null);
        return;
      }
      const meta = user.user_metadata ?? {};
      setAccount({
        // 이름이 없을 수도 있다. 그때는 이메일 앞부분이라도 보여준다.
        name:
          (meta.full_name as string) ||
          (meta.name as string) ||
          user.email?.split("@")[0] ||
          "내 계정",
        avatar: meta.avatar_url as string | undefined,
      });
    };

    supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) =>
      apply(session?.user ?? null),
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // 아직 모를 때는 자리를 비워 둔다. 로그인했는데 "로그인" 버튼이
  // 잠깐 스쳤다가 바뀌면 눌러 버리는 사람이 생긴다.
  if (!ready) return <span className="h-8" aria-hidden="true" />;

  if (!account) {
    return (
      <Link
        href="/login"
        className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
      >
        로그인
      </Link>
    );
  }

  const signOut = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setSigningOut(true);
    await supabase.auth.signOut();

    /*
      이 기기의 목록을 비우고 통째로 새로고침한다.

      CollectionSync 도 로그아웃을 듣고 비우지만, 여기서 한 번 더 비운다 —
      새로고침이 그 처리보다 먼저 일어나면 앞사람의 목록이 남고, 다음 사람이
      로그인할 때 그 사람 계정으로 합쳐진다. 두 번 비우는 편이 낫다.

      router.refresh() 가 아니라 통째로 새로고침하는 것도 같은 이유다.
      앞사람의 화면 상태가 조금도 남지 않는다.
    */
    writeCollections({ wishlist: [], trip: [] });
    window.location.reload();
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      {account.avatar && (
        // 다른 서비스의 프로필 사진이라 도메인을 미리 알 수 없다.
        // next/image 를 쓰려면 도메인을 등록해야 해서 그냥 img 로 둔다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
      )}
      {/*
        좁은 화면에서는 이름을 접는다. 위 띠에 서비스 이름과 갈래 둘이
        함께 서 있어 375px 에서 이 칩이 화면 밖으로 밀려났다. 사진이
        있으면 그것으로 누구인지 알 수 있으니 이름은 접어도 된다.
      */}
      <span
        className={`max-w-[10ch] truncate text-[13px] font-medium text-text ${
          account.avatar ? "hidden sm:inline" : ""
        }`}
      >
        {account.name}
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text-muted transition hover:bg-line disabled:opacity-60"
      >
        로그아웃
      </button>
    </div>
  );
}
