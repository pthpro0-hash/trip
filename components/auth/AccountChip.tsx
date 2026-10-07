"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { accountOf, type Account } from "@/lib/account";
import { ME_HREF, activeNav } from "@/lib/nav";

/*
  지금 누구로 들어와 있는지, 그리고 '내 정보'로 가는 문.

  예전에는 이름을 누르면 가족 공유로만 갔고, 로그아웃 단추도 여기 붙어 있었다. 이제 이름·사진은 가족 공유·
  가족 우편함·보관함 정리·로그아웃이 모인 내 정보로 간다. 폰의 위 띠가 빠듯해 로그아웃은 거기로 옮겼다.
*/
export function AccountChip() {
  const pathname = usePathname();
  const [account, setAccount] = useState<Account | null>(null);
  // 로그인 설정이 아예 없으면 기다릴 것도 없다. 효과 안에서 setState 하지
  // 않도록 처음 값으로 정한다.
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;

    const apply = (user: { user_metadata?: Record<string, unknown>; email?: string } | null) => {
      if (!active) return;
      setReady(true);
      setAccount(user ? accountOf(user) : null);
    };

    supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));

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

  const on = activeNav(pathname, null) === "me";

  return (
    /*
      좁은 화면에서는 이름을 접는다. 위 띠에 서비스 이름과 갈래 둘이
      함께 서 있어 375px 에서 이 칩이 화면 밖으로 밀려났다. 사진이
      있으면 그것으로 누구인지 알 수 있으니 이름은 접어도 된다.
    */
    <Link
      href={ME_HREF}
      aria-label="내 정보"
      title="내 정보"
      aria-current={on ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full transition ${on ? "bg-accent-soft pr-2.5" : "hover:opacity-80"}`}
    >
      {account.avatar && (
        // 다른 서비스의 프로필 사진이라 도메인을 미리 알 수 없다.
        // next/image 를 쓰려면 도메인을 등록해야 해서 그냥 img 로 둔다.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
      )}
      <span
        className={`max-w-[10ch] truncate text-[13px] font-medium text-text ${
          account.avatar ? "hidden sm:inline" : ""
        }`}
      >
        {account.name}
      </span>
    </Link>
  );
}
