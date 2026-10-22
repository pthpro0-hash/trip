"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { accountOf, type Account } from "@/lib/account";
import { signOutAndReload } from "@/lib/signOut";
import { getBrowserClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/supabase/lazy";
import { fetchMailboxes } from "@/lib/supabase/mailbox";
import { mailboxPath } from "@/lib/mailbox";
import { countPendingSuggestions, isAdmin } from "@/lib/supabase/spotSuggestions";
import { fetchUnreadHeartCount, fetchUnreadReplyCount } from "@/lib/supabase/postcards";
import { fetchGradeRequests } from "@/lib/supabase/grade";
import { PhotoQuota } from "./PhotoQuota";

/*
  내 정보 — 흩어져 있던 것들이 한 곳에 모인 메뉴.

  예전에는 위 띠의 이름을 눌러야 '가족 공유'가 열렸고, 가족 사진첩은 그 맨 아래 링크로만 갈 수 있었다.
  폰에서는 이름이 접혀 사진만 남아 그것이 메뉴인지도 알기 어려웠다. 이제 폰의 하단 탭 맨 끝과 위 띠의
  이름·사진이 모두 여기로 온다. 로그아웃도 여기 있다(폰의 위 띠가 빠듯해서).

  가족 사진첩은 줄이 둘이다. '가족 사진첩'은 관리 화면(설정·보낸 엽서·링크), 그 아래 사진첩마다 한 줄은 그 사진첩 안(묶음)으로
  바로 들어가는 길이다. 예전에는 관리 화면 → '부모님 화면 보기'를 거쳐야 묶음이 보여 찾지 못했다.

  로그인하지 않았으면 로그인이 필요한 길은 내지 않고, 안내(도움말·처리방침·약관)만 남긴다.
*/

/** 내 정보에 줄을 낼 사진첩 하나. */
export interface ShelfLink {
  id: string;
  name: string;
  token: string;
}

function Row({
  href,
  title,
  hint,
  badge,
  nested,
}: {
  href: string;
  title: string;
  hint: string;
  badge?: string;
  /** 위 줄의 한 갈래 — 안으로 조금 들여 쓴다. */
  nested?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[60px] items-center gap-3 rounded-2xl bg-bg-subtle px-4 py-3 transition hover:bg-line ${nested ? "ml-5" : ""}`}
    >
      {nested && (
        <span aria-hidden="true" className="shrink-0 text-[20px]">
          📚
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold text-text">{title}</span>
        <span className="text-[13px] leading-snug text-text-muted">{hint}</span>
      </span>
      {badge && <span className="shrink-0 rounded-full bg-[#d70015] px-2.5 py-0.5 text-[12px] font-bold text-white">{badge}</span>}
      <span aria-hidden="true" className="shrink-0 text-[18px] text-text-faint">
        ›
      </span>
    </Link>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[13px] font-semibold text-text-faint">{title}</h2>
      {children}
    </section>
  );
}

const GUIDE = (
  <Group title="안내">
    <Row href="/help" title="도움말" hint="쓰는 법과 자주 묻는 것" />
    <Row href="/privacy" title="개인정보처리방침" hint="무엇을 모으고 어떻게 지키는지" />
    <Row href="/terms" title="이용약관" hint="서비스를 쓰는 약속" />
  </Group>
);

export type MyInfoState = Account | "loading" | "login";

/** 그리기만 한다. 누구인지·새 소식이 몇 개인지는 MyInfo 가 알아 와서 넘긴다. */
export function MyInfoView({
  state,
  unread,
  shelves = [],
  waiting = null,
  requests = 0,
  storage = null,
  signingOut,
  onSignOut,
}: {
  state: MyInfoState;
  /** 관리자일 때 검토 전인 등업 신청 수. */
  requests?: number;
  /** 사진 보관 칸(보관 한도·사용량·등업 신청). 로그인했을 때만 MyInfo 가 넣는다. */
  storage?: ReactNode;
  unread: number;
  /** 관리자일 때 검토 전인 빠진 곳 추천 수(관리자가 아니면 null — 관리 줄을 내지 않는다). */
  waiting?: number | null;
  /** 들어가 볼 수 있는 내 사진첩들(닫은 것·남의 것은 빠진다). 못 읽었으면 빈 목록. */
  shelves?: ShelfLink[];
  signingOut: boolean;
  onSignOut: () => void;
}) {
  // 아직 모를 때는 로그인 단추를 내지 않는다. 로그인했는데 단추가 잠깐 스쳤다가 바뀌면 눌러 버리는 사람이 생긴다.
  if (state === "loading") {
    return (
      <main className="mx-auto max-w-xl px-5 pb-20 pt-8">
        <p className="text-[15px] text-text-muted">불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-20 pt-8">
      <header className="flex items-center gap-3">
        {state !== "login" && state.avatar && (
          // 다른 서비스의 프로필 사진이라 도메인을 미리 알 수 없다. next/image 를 쓰려면 도메인을 등록해야 해서 그냥 img 로 둔다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold tracking-tight text-text">내 정보</h1>
          {state !== "login" && <p className="truncate text-[15px] text-text-muted">{state.name}</p>}
        </div>
        {/* 로그아웃은 맨 위 이름 옆에 둔다 — 아래 끝에 있으면 사진 보관·가족·안내를 다 지나야 보였다. */}
        {state !== "login" && (
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="shrink-0 rounded-full bg-surface px-4 py-2 text-[14px] font-medium text-text-muted ring-1 ring-line transition hover:bg-bg-subtle hover:text-text disabled:opacity-60"
          >
            로그아웃
          </button>
        )}
      </header>

      {state === "login" ? (
        <section className="flex flex-col items-start gap-3 rounded-2xl bg-accent-soft p-4">
          <p className="text-[15px] leading-relaxed text-text">로그인하면 가족 공유·가족 사진첩을 쓸 수 있어요.</p>
          <Link
            href="/login?next=/me"
            className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            로그인하기
          </Link>
        </section>
      ) : (
        <>
          {storage}
          <Group title="가족">
            <Row href="/family" title="가족 공유" hint="가족을 초대해 내 여행을 함께 봐요" />
            <Row
              href="/mailboxes"
              title="가족 사진첩"
              hint="부모님께 엽서 보내기 — 앱도 로그인도 필요 없어요"
              badge={unread > 0 ? `새 소식 ${unread}` : undefined}
            />
            {shelves.map((shelf) => (
              // 미리보기 방식으로 들어간다 — 열어 본 표시·답장·하트는 부모님께 가지 않고, 안 열어 본 엽서도 묶음에 모여 보인다.
              <Row key={shelf.id} nested href={mailboxPath(shelf.token, "all")} title={shelf.name} hint="묶음 안으로 들어가기" />
            ))}
          </Group>
          {waiting !== null && (
            <Group title="관리">
              <Row
                href="/admin"
                title="회원 관리"
                hint="등급(사진 보관 한도)·등업 신청·계정 보기"
                badge={requests > 0 ? `등업 신청 ${requests}` : undefined}
              />
              <Row
                href="/admin/suggestions"
                title="빠진 곳 추천 관리"
                hint="이용자가 보낸 추천을 보고 반영 여부를 정해요"
                badge={waiting > 0 ? `검토 전 ${waiting}` : undefined}
              />
            </Group>
          )}
        </>
      )}

      {GUIDE}
    </main>
  );
}

export function MyInfo() {
  const [state, setState] = useState<MyInfoState>("loading");
  const [unread, setUnread] = useState(0);
  const [shelves, setShelves] = useState<ShelfLink[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [requests, setRequests] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = getBrowserClient();
      if (!supabase) return setState("login");
      try {
        const { data } = await currentUser(supabase);
        if (!data.user) return setState("login");
        setState(accountOf(data.user));
        setUserId(data.user.id);
        // 새 소식과 사진첩 줄은 곁다리다. 못 세고 못 읽으면 숫자·줄 없이 조용히 둔다(관리 줄은 그대로 남는다).
        const [replies, hearts, boxes] = await Promise.all([
          fetchUnreadReplyCount(supabase),
          fetchUnreadHeartCount(supabase),
          fetchMailboxes(supabase, data.user.id).catch(() => "failed" as const),
        ]);
        setUnread(replies + hearts);
        // 관리자라면 관리 줄을 낸다. 관리자가 아니거나 못 알아보면 아무것도 내지 않는다.
        if (await isAdmin(supabase, data.user.id)) {
          setWaiting((await countPendingSuggestions(supabase)) ?? 0);
          const asked = await fetchGradeRequests(supabase);
          if (asked !== "failed") setRequests(asked.filter((item) => item.status === "pending").length);
        }
        if (boxes !== "failed") {
          setShelves(boxes.owned.filter((box) => !box.closed).map((box) => ({ id: box.id, name: box.name, token: box.token })));
        }
      } catch {
        setState((current) => (current === "loading" ? "login" : current));
      }
    };
    // 처음 한 번 부른다.
    void load();
  }, []);

  const signOut = async () => {
    const supabase = getBrowserClient();
    if (!supabase || signingOut) return;
    setSigningOut(true);
    try {
      await signOutAndReload(supabase);
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <MyInfoView
      state={state}
      unread={unread}
      shelves={shelves}
      waiting={waiting}
      requests={requests}
      storage={userId ? <PhotoQuota userId={userId} /> : null}
      signingOut={signingOut}
      onSignOut={() => void signOut()}
    />
  );
}
