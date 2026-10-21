"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/supabase/lazy";
import {
  cancelMailboxInvite,
  createMailbox,
  createMailboxInvite,
  deleteMailbox,
  fetchMailboxInvites,
  fetchMailboxes,
  leaveMailbox,
  planMailboxDelete,
  planMailboxTrim,
  rotateMailboxToken,
  setMailboxClosed,
  trimMailbox,
  updateMailbox,
  updateMailboxSettings,
  type MailboxInput,
  type MailboxItem,
  type MailboxList,
  type MailboxTrimPlan,
  type PendingMailboxInvite,
} from "@/lib/supabase/mailbox";
import { fetchSentPostcards, markHeartsSeen, markRepliesSeen, withdrawPostcard, type SentPostcard } from "@/lib/supabase/postcards";
import { heartTarget, summarizeHearts } from "@/lib/mailboxHearts";
import { attachParticle } from "@/lib/korean";
import type { MailboxSettings } from "@/lib/mailboxSettings";
import { REPLIES_SEEN } from "./MailboxBell";
import { MAILBOX_LIMIT, MAILBOX_SENDER_LIMIT, mailboxInviteUrl, mailboxPath, mailboxUrl, type Tone } from "@/lib/mailbox";
import { firstShelfInput } from "@/lib/mailboxFirst";
import { postcardFileUrl } from "@/lib/supabase/mailboxPublic";
import { FirstShelfForm } from "./send/FirstShelfForm";
import { INVITE_DAYS } from "@/lib/family";
import { MailboxForm } from "./MailboxForm";
import { trimSavingsText } from "@/lib/mailboxSettings";
import { MailboxSettingsEditor } from "./MailboxSettingsEditor";

/*
  가족 사진첩 — 집 한 곳당 하나. 부모님 두 분은 한 사진첩에서 같이 받는다.

  두 겹이다. 목록(표지가 있는 카드, 새 사진첩, 들어간 사진첩)에서 하나를 열면 그 사진첩의 화면이 나온다 — 맨 앞에는
  [링크 보내기]와 [부모님 화면으로 보기]만 있고, 그 아래가 엽서 · 반응 · 설정이다. 예전에는 한 화면에 모든 단추가 있었고
  "더 보기" 안에 일곱 개가 숨어 있었다. 주소는 /mailboxes?box=<id> — 뒤로 가기로 목록에 돌아온다.

  되돌릴 수 없는 일(링크 새로 만들기, 닫기, 지우기, 나가기)은 한 번 더 묻는다. 지우기는 닫은 사진첩에만 있다 —
  닫기(되돌릴 수 있다) → 지우기(되돌릴 수 없다) 두 단계라 실수로 지우기 어렵다.
*/

/** 사진첩 화면의 세 갈래. */
type Tab = "letters" | "reactions" | "settings";

/** trims: 사진첩 id → 오래된 엽서의 사진을 줄일 계획(줄일 엽서가 있는 사진첩만). */
type Loaded = {
  userId: string;
  list: MailboxList;
  invites: PendingMailboxInvite[];
  sent: SentPostcard[];
  trims: Record<string, MailboxTrimPlan>;
};

const TONE_LABEL = { casual: "편하게", polite: "존댓말" } as const;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div>
        <h2 className="text-[18px] font-bold tracking-tight text-text">{title}</h2>
        {note && <p className="mt-1 text-[14px] leading-relaxed text-text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const pill =
  "rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text transition hover:bg-line disabled:opacity-60";

/**
 * 부모님 화면을 미리 본다(새 탭). 받는 쪽 화면 그대로이되 "열어 봤다" 표시·답장·하트는 가지 않는다.
 * 모든 엽서를 열어 본 것처럼 보여 준다 — 부모님이 열어 본 엽서가 없으면 묶음이 비어 있어, 보내는 쪽에서는 묶음을
 * 볼 길이 없기 때문이다(화면 위 띠에서 '지금 부모님이 보시는 대로'로 바꿀 수 있다).
 * 닫은 사진첩은 부모님께 아무것도 안 보이니 미리볼 것도 없다.
 */
function Preview({ box, wide = false }: { box: MailboxItem; wide?: boolean }) {
  // wide: 사진첩 화면 맨 앞의 큰 단추. 아니면 목록 줄 안의 작은 알약.
  const look = wide
    ? "flex-1 rounded-full bg-surface px-5 py-3 text-center text-[15px] font-medium text-text ring-1 ring-line transition hover:bg-bg-subtle disabled:opacity-60"
    : pill;
  if (box.closed) {
    return (
      <button type="button" className={look} disabled>
        부모님 화면으로 보기
      </button>
    );
  }
  return (
    <a href={mailboxPath(box.token, "all")} target="_blank" rel="noopener noreferrer" className={look}>
      부모님 화면으로 보기
    </a>
  );
}

export function MailboxPanel() {
  const [state, setState] = useState<Loaded | "loading" | "login" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** 만들기 칸이 열려 있나, 고치는 중인 사진첩 id. */
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** 설정 칸이 열려 있는 사진첩 id. */
  const [configuring, setConfiguring] = useState<string | null>(null);
  /** 한 번 더 묻는 중인 일("rotate-<id>", "close-<id>", "leave-<id>"). */
  const [asking, setAsking] = useState<string | null>(null);
  /** 지우기 확인 창이 말할 숫자 — 이 사진첩에만 보낸 엽서(지워진다)와 다른 사진첩에도 가서 남는 엽서. */
  const [deletePlan, setDeletePlan] = useState<{ id: string; sole: number; kept: number } | null>(null);
  /** 방금 만든 보내는 사람 초대의 글자(바로 복사할 수 있게 크게 보여 준다). */
  const [freshInvite, setFreshInvite] = useState<string | null>(null);
  /*
    이번에 처음 본 답장·하트들. 화면을 열면 답장을 "봤다"고 표시하는데, 그 순간 "새 답장" 표시까지 사라지면
    무엇이 새것인지 알 수 없다. 이 화면에 머무는 동안은 새것으로 남겨 둔다(다른 일로 목록을 다시 받아도).
  */
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  /*
    열어 본 사진첩(없으면 목록)과 그 안의 갈래. 열어 본 것은 주소(?box=)에 적어, 뒤로 가기로 목록에 돌아오고 새로 고쳐도 그 자리다.
    방금 만든 사진첩에는 "링크를 보내 주세요" 안내를 한 번 보인다.
  */
  const [openId, setOpenId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("box"),
  );
  const [tab, setTab] = useState<Tab>("letters");
  const [justMade, setJustMade] = useState<string | null>(null);

  useEffect(() => {
    const read = () => setOpenId(new URLSearchParams(window.location.search).get("box"));
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return setState("failed");
    const { data } = await currentUser(supabase);
    if (!data.user) return setState("login");
    const [list, invites, sent] = await Promise.all([
      fetchMailboxes(supabase, data.user.id),
      fetchMailboxInvites(supabase, data.user.id),
      // 보낸 엽서는 곁다리다. 못 읽어도 사진첩 관리는 된다.
      fetchSentPostcards(supabase, data.user.id).catch(() => []),
    ]);
    if (list === "failed" || invites === "failed") return setState("failed");
    // 오래된 엽서의 사진 줄이기는 곁다리다. 못 읽으면(서버 설정 전) 그 칸만 없다. 열려 있고 보관을 '전부'로 안 둔 곳만 묻는다.
    const trims: Record<string, MailboxTrimPlan> = {};
    await Promise.all(
      list.owned
        .filter((box) => !box.closed && box.settings.keep !== "all")
        .map(async (box) => {
          const plan = await planMailboxTrim(supabase, box.id);
          if (plan && plan.books.length > 0) trims[box.id] = plan;
        }),
    );
    setState({ userId: data.user.id, list, invites, sent, trims });

    // 아직 못 본 답장·하트는 이 화면이 보여 주는 순간 "봤다"고 적는다. 위 띠의 새 소식 표시도 따라 사라진다.
    const unseen = sent.flatMap((card) => card.replies.filter((reply) => !reply.seen).map((reply) => reply.id));
    const unseenHearts = sent.flatMap((card) => card.hearts.filter((heart) => !heart.seen).map((heart) => heart.id));
    if (unseen.length > 0 || unseenHearts.length > 0) {
      setFresh((current) => new Set([...current, ...unseen, ...unseenHearts]));
      void Promise.all([
        unseen.length > 0 ? markRepliesSeen(supabase, unseen) : true,
        unseenHearts.length > 0 ? markHeartsSeen(supabase, unseenHearts) : true,
      ])
        .then(() => window.dispatchEvent(new Event(REPLIES_SEEN)))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    // 처음 한 번 부른다. 불러온 뒤에 상태가 바뀌는 것은 비동기라 효과 안의 동기 setState 가 아니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state === "loading") return <p className="text-[15px] text-text-muted">불러오는 중…</p>;
  if (state === "login") {
    return (
      <p className="text-[15px] text-text-muted">
        가족 사진첩은 로그인해야 쓸 수 있어요.{" "}
        <Link href="/login?next=/mailboxes" className="font-medium text-accent hover:text-accent-hover">
          로그인하기
        </Link>
      </p>
    );
  }
  if (state === "failed") {
    return (
      <p className="text-[15px] text-text-muted">
        불러오지 못했어요.{" "}
        <button type="button" onClick={() => void load()} className="font-medium text-accent hover:text-accent-hover">
          다시 시도
        </button>
      </p>
    );
  }

  const { userId, list, invites, sent, trims } = state;
  const nameOf = new Map([...list.owned, ...list.joined].map((box) => [box.id, box.name]));
  const openCount = list.owned.filter((box) => !box.closed).length;
  const full = openCount >= MAILBOX_LIMIT;

  /** 사진첩 하나를 열거나(id) 목록으로 돌아간다(null). 주소에 적어 뒤로 가기가 되게 한다. */
  const show = (id: string | null) => {
    setOpenId(id);
    setTab("letters");
    setEditing(null);
    setConfiguring(null);
    setAsking(null);
    setDeletePlan(null);
    setMessage(null);
    if (id === null) setJustMade(null);
    window.history.pushState(null, "", id ? `/mailboxes?box=${encodeURIComponent(id)}` : "/mailboxes");
    try {
      window.scrollTo({ top: 0 });
    } catch {
      // 맨 위로 올리지 못해도 화면은 그대로 쓸 수 있다.
    }
  };

  /** 무엇을 하든 끝나면 목록을 다시 받는다. 실패는 한 줄로 알린다. */
  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    const failure = await task();
    if (failure) setMessage(failure);
    await load();
    setBusy(false);
  };

  const copy = async (url: string, done: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage(done);
    } catch {
      // 복사가 막힌 브라우저에서는 보이는 주소를 직접 고르게 둔다.
      setMessage(`복사하지 못했어요. 이 주소를 직접 복사해 주세요: ${url}`);
    }
  };

  /** 받는 분과 말투만으로 사진첩을 만든다(이름 · 부르는 말은 거기서 지어진다 — lib/mailboxFirst). 만들면 그 사진첩을 열어 링크를 보내게 한다. */
  const createFirst = (answer: { who: string; tone: Tone }) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const input = firstShelfInput(answer.who, answer.tone);
      if (!input) return "받는 분을 적어 주세요. 예: 엄마, 아빠";
      const result = await createMailbox(supabase, userId, input);
      if (result.ok) {
        setCreating(false);
        setJustMade(result.id);
        show(result.id);
        return null;
      }
      if (result.reason === "limit") return `사진첩은 ${MAILBOX_LIMIT}개까지 열어 둘 수 있어요.`;
      if (result.reason === "invalid") return "이름은 1~40자, 부르는 말은 20자까지예요.";
      return "만들지 못했어요. 잠시 뒤 다시 해 주세요.";
    });

  const edit = (id: string, input: MailboxInput) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const result = await updateMailbox(supabase, id, input);
      if (result.ok) {
        setEditing(null);
        return null;
      }
      return result.reason === "invalid" ? "이름은 1~40자, 부르는 말은 20자까지예요." : "고치지 못했어요.";
    });

  const saveSettings = (id: string, settings: MailboxSettings) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const result = await updateMailboxSettings(supabase, id, settings);
      if (result.ok) {
        setConfiguring(null);
        return null;
      }
      return "설정을 저장하지 못했어요. 잠시 뒤 다시 해 주세요.";
    });

  const rotate = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const token = await rotateMailboxToken(supabase, box.id);
      if (token === "failed") return "링크를 새로 만들지 못했어요.";
      setAsking(null);
      await copy(mailboxUrl(window.location.origin, token), "새 링크를 복사했어요. 옛 링크는 이제 열리지 않아요. 받는 분께 새 링크를 보내 주세요.");
      return null;
    });

  const toggleClosed = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const result = await setMailboxClosed(supabase, box.id, !box.closed);
      setAsking(null);
      if (result.ok) return null;
      return result.reason === "limit"
        ? `열려 있는 사진첩이 이미 ${MAILBOX_LIMIT}개예요. 하나를 닫고 다시 열어 주세요.`
        : "바꾸지 못했어요.";
    });

  /** 지우기 전에 무엇이 지워지는지 읽어 와 한 번 더 묻는다. 못 읽으면 모르는 채로 지우게 하지 않는다. */
  const askDelete = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const plan = await planMailboxDelete(supabase, box.id);
      if (!plan) return "지울 내용을 읽지 못했어요. 잠시 뒤 다시 해 주세요. 계속 안 되면 서버 설정(supabase/mailbox.sql)을 다시 실행해야 할 수 있어요.";
      setDeletePlan({ id: box.id, sole: plan.sole.length, kept: plan.kept });
      setAsking(`delete-${box.id}`);
      return null;
    });

  const removeBox = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const result = await deleteMailbox(supabase, box.id);
      if (result === "ok") {
        setAsking(null);
        setDeletePlan(null);
        return "사진첩을 지웠어요.";
      }
      // 못 지웠으면 확인 창을 그대로 둔다 — 다시 누르면 된다.
      return result === "files"
        ? "사진을 모두 지우지 못했어요. 사진첩은 그대로 있어요. 잠시 뒤 다시 해 주세요."
        : "사진첩을 지우지 못했어요. 잠시 뒤 다시 해 주세요.";
    });

  /** 보관 권수를 넘은 오래된 엽서의 사진 파일을 지우고 기록을 맞춘다. 못 지웠으면 확인 창을 그대로 둔다 — 다시 누르면 된다. */
  const trimBooks = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const result = await trimMailbox(supabase, box.id);
      if (result.ok) {
        setAsking(null);
        return `오래된 엽서 ${result.books}장의 사진 ${result.files}장을 줄였어요.`;
      }
      return result.reason === "files"
        ? "사진을 모두 지우지 못했어요. 지운 만큼만 줄였어요. 잠시 뒤 다시 해 주세요."
        : "사진을 줄이지 못했어요. 잠시 뒤 다시 해 주세요.";
    });

  const invite = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const token = await createMailboxInvite(supabase, box.id, userId);
      if (token === "failed") return "초대를 만들지 못했어요.";
      setFreshInvite(token);
      return null;
    });

  const cancelInvite = (token: string) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      if (freshInvite === token) setFreshInvite(null);
      return (await cancelMailboxInvite(supabase, token)) ? null : "초대를 취소하지 못했어요.";
    });

  const withdraw = (card: SentPostcard) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      setAsking(null);
      return (await withdrawPostcard(supabase, card.id)) ? null : "엽서를 거두지 못했어요. 다시 눌러 주세요.";
    });

  const leave = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      setAsking(null);
      return (await leaveMailbox(supabase, box.id, userId)) ? null : "나가지 못했어요.";
    });

  /** 이 사진첩에 든 엽서만. */
  const lettersOf = (box: MailboxItem) => sent.filter((card) => card.deliveries.some((delivery) => delivery.mailboxId === box.id));

  /** 사진첩 카드의 표지 — 가장 최근에 이 사진첩에 보낸 엽서의 첫 사진. */
  const coverOf = (box: MailboxItem) => {
    const card = lettersOf(box).find((one) => one.cover);
    return card?.cover ? postcardFileUrl(card.id, card.cover) : null;
  };

  /** 이 사진첩에 아직 못 본 답장·하트가 몇 줄인가(이 화면에 머무는 동안 새것으로 남겨 둔 것). */
  const freshCount = (box: MailboxItem) =>
    lettersOf(box).reduce(
      (sum, card) =>
        sum +
        card.replies.filter((reply) => reply.mailboxId === box.id && fresh.has(reply.id)).length +
        summarizeHearts(card.hearts.filter((heart) => heart.mailboxId === box.id)).filter((line) => line.ids.some((id) => fresh.has(id))).length,
      0,
    );

  /** 받는 분께 링크를 보낸다 — 폰의 공유창이 열리면 거기로(카카오톡 등), 아니면 복사한다. */
  const sendLink = async (box: MailboxItem) => {
    const url = mailboxUrl(window.location.origin, box.token);
    const text = `${box.name} 링크예요. 눌러서 열어 보세요.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: box.name, text, url });
        return;
      } catch (error) {
        // 공유창을 그냥 닫은 것은 아무 일도 아니다. 그 밖의 막힘만 복사로 물러난다.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy(url, "받는 분께 보낼 링크를 복사했어요. 카카오톡이나 문자에 붙여 넣어 보내 주세요.");
  };

  /** 보낸 엽서 한 장. only 가 있으면 그 사진첩의 열어 봄·답장·하트만 보인다. */
  const sentCard = (card: SentPostcard, only?: string) => {
    const deliveries = only ? card.deliveries.filter((delivery) => delivery.mailboxId === only) : card.deliveries;
    const replies = only ? card.replies.filter((reply) => reply.mailboxId === only) : card.replies;
    const hearts = only ? card.hearts.filter((heart) => heart.mailboxId === only) : card.hearts;
    const cover = card.cover ? postcardFileUrl(card.id, card.cover) : null;
    return (
      <li key={card.id} className="flex flex-col gap-1.5 rounded-xl bg-bg px-3.5 py-3 ring-1 ring-line">
        <div className="flex items-start gap-3">
          {cover && (
            // 엽서 보관함의 공개 주소라 next/image 로 미리 최적화할 수 없다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
          )}
          <p className="min-w-0 text-[15px] font-semibold text-text">
            {card.title || "제목 없는 여행"}
            <span className="ml-2 text-[13px] font-normal text-text-faint">
              {card.startedOn ? new Date(card.startedOn).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : ""}
            </span>
          </p>
        </div>
        <ul className="flex flex-col gap-0.5 text-[13px] text-text-muted">
          {deliveries.map((delivery) => (
            <li key={delivery.mailboxId}>
              {only ? "" : `${nameOf.get(delivery.mailboxId) ?? "사진첩"} · `}
              <span className={delivery.opened ? "text-accent" : ""}>{delivery.opened ? "열어 보셨어요" : "아직 안 열어 보셨어요"}</span>
            </li>
          ))}
        </ul>
        {replies.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label={`${card.title || "여행"} 답장`}>
            {replies.map((reply) => (
              <li key={reply.id} className="flex flex-wrap items-center gap-1.5 text-[14px] text-text">
                <span aria-hidden="true">💬</span>
                <span>
                  {attachParticle(reply.who, "이", "가")} &lsquo;{reply.reaction}&rsquo; 하셨어요
                </span>
                {!only && card.deliveries.length > 1 && <span className="text-[12px] text-text-faint">· {nameOf.get(reply.mailboxId) ?? "사진첩"}</span>}
                {fresh.has(reply.id) && <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">새 답장</span>}
              </li>
            ))}
          </ul>
        )}
        {hearts.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label={`${card.title || "여행"} 하트`}>
            {summarizeHearts(hearts).map((line) => (
              <li key={`${line.mailboxId}|${line.who}`} className="flex flex-wrap items-center gap-1.5 text-[14px] text-text">
                <span aria-hidden="true" className="text-[#e0245e]">
                  ♥
                </span>
                <span>
                  {attachParticle(line.who, "이", "가")} {heartTarget(line)} 하트를 눌렀어요
                </span>
                {!only && card.deliveries.length > 1 && <span className="text-[12px] text-text-faint">· {nameOf.get(line.mailboxId) ?? "사진첩"}</span>}
                {line.ids.some((id) => fresh.has(id)) && <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">새 하트</span>}
              </li>
            ))}
          </ul>
        )}
        {asking === `withdraw-${card.id}` ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-text">거두면 받는 분이 더는 볼 수 없어요.</span>
            <button type="button" disabled={busy} onClick={() => void withdraw(card)} className="rounded-full bg-text px-3.5 py-1.5 font-medium text-bg">
              거두기
            </button>
            <button type="button" onClick={() => setAsking(null)} className="text-text-muted">
              그만두기
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAsking(`withdraw-${card.id}`)} className="self-start text-[13px] font-medium text-text-muted hover:text-text">
            엽서 거두기
          </button>
        )}
      </li>
    );
  };

  /** 오래된 엽서의 사진 줄이기 — 있을 때만. */
  const trimBlock = (box: MailboxItem) => {
    if (!trims[box.id]) return null;
    const books = trims[box.id].books.length;
    const files = trims[box.id].books.reduce((sum, book) => sum + book.drop.length, 0);
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-accent-soft p-3 text-[13px] leading-relaxed">
        {asking === `trim-${box.id}` ? (
          <>
            <p className="font-medium text-text">
              오래된 엽서 {books}장의 사진 {files}장을 지워요({trimSavingsText(files)}). 표지와 하트 받은 사진은 남고, 한 줄 인사말·지도·답장·하트는 그대로예요. 되돌릴 수 없어요.
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={busy} onClick={() => void trimBooks(box)} className="rounded-full bg-text px-3.5 py-1.5 font-medium text-bg disabled:opacity-60">
                줄이기
              </button>
              <button type="button" onClick={() => setAsking(null)} className="text-text-muted">
                그만두기
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-text">
              오래된 엽서 {books}장의 사진 {files}장을 줄일 수 있어요 · {trimSavingsText(files)} 절약
            </p>
            <button type="button" className={`${pill} self-start`} onClick={() => setAsking(`trim-${box.id}`)}>
              사진 줄이기
            </button>
          </>
        )}
      </div>
    );
  };

  /** 사진첩 하나 — 엽서 · 반응 · 설정. */
  const detailView = (box: MailboxItem) => {
    const letters = lettersOf(box);
    const boxInvites = invites.filter((entry) => entry.mailboxId === box.id);
    const news = freshCount(box);
    const tabs: { id: Tab; label: string }[] = [
      { id: "letters", label: `엽서 ${letters.length}` },
      { id: "reactions", label: news > 0 ? `반응 · 새 소식 ${news}` : "반응" },
      { id: "settings", label: "설정" },
    ];
    const reacted = letters.filter((card) => card.replies.some((reply) => reply.mailboxId === box.id) || card.hearts.some((heart) => heart.mailboxId === box.id));

    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => show(null)} aria-label="가족 사진첩 목록으로" className="flex items-center gap-1 self-start text-[14px] font-medium text-text-muted hover:text-text">
          <span aria-hidden="true">‹</span> 가족 사진첩
        </button>

        <div data-closed={box.closed ? "true" : undefined} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[20px] font-bold tracking-tight text-text">{box.name}</h2>
            {box.closed && <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-[12px] text-text-muted">닫혀 있어요</span>}
          </div>
          <p className="text-[13px] leading-relaxed text-text-muted">받는 분 {box.members.length > 0 ? box.members.join(" · ") : "—"}</p>

          {justMade === box.id && (
            <p role="note" className="rounded-xl bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-text">
              사진첩을 만들었어요. 이제 받는 분께 링크를 보내 주세요. 받는 분은 앱도 로그인도 없이 링크 하나로 열어요.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={box.closed}
              onClick={() => void sendLink(box)}
              className="flex-1 rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              링크 보내기
            </button>
            <Preview box={box} wide />
          </div>
        </div>

        <div role="tablist" aria-label="사진첩 보기" className="flex gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`album-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls="album-panel"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded-full px-3 py-2 text-[14px] font-medium transition ${
                tab === item.id ? "bg-accent text-on-accent" : "bg-surface text-text-muted ring-1 ring-line hover:text-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id="album-panel" aria-labelledby={`album-tab-${tab}`} className="flex flex-col gap-3">
          {tab === "letters" && (
            <>
              {trimBlock(box)}
              {letters.length === 0 ? (
                <div className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
                  <p className="text-[15px] font-semibold text-text">아직 보낸 엽서가 없어요</p>
                  <p className="text-[14px] leading-relaxed text-text-muted">다녀온 여행에서 ‘엽서 보내기’를 누르면 이 사진첩에 도착해요.</p>
                  <Link href="/trips" className={`${pill} self-start`}>
                    엽서 보낼 여행 고르기
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-[13px] leading-relaxed text-text-muted">
                    받는 분이 열어 봤는지, 답장했는지 볼 수 있어요. 엽서는 보낸 순간 그대로 남고, 거두면 모든 사진첩에서 사라져요.
                  </p>
                  <ul aria-label={`${box.name} 엽서`} className="flex flex-col gap-2">
                    {letters.map((card) => sentCard(card, box.id))}
                  </ul>
                  <Link href="/trips" className={`${pill} self-start`}>
                    + 엽서 더 보내기
                  </Link>
                </>
              )}
            </>
          )}

          {tab === "reactions" &&
            (reacted.length === 0 ? (
              <div className="flex flex-col gap-1.5 rounded-2xl bg-surface p-5 ring-1 ring-line">
                <p className="text-[15px] font-semibold text-text">아직 답장이나 하트가 없어요</p>
                <p className="text-[14px] leading-relaxed text-text-muted">받는 분이 엽서를 열어 보고 답하거나 하트를 누르면 여기에 모여요.</p>
              </div>
            ) : (
              <ul aria-label={`${box.name} 반응`} className="flex flex-col gap-2">
                {reacted.map((card) => sentCard(card, box.id))}
              </ul>
            ))}

          {tab === "settings" && (
            <div className="flex flex-col gap-4">
              <dl className="flex flex-col gap-2 rounded-2xl bg-surface p-5 text-[14px] ring-1 ring-line">
                {[
                  ["받는 분", box.members.length > 0 ? box.members.join(" · ") : "—"],
                  ["말투", TONE_LABEL[box.tone]],
                  ["부르는 말", box.greetingName && box.useGreeting ? box.greetingName : "붙이지 않아요"],
                  ["엽서 한 장의 사진", `${box.settings.photos}장`],
                  ["보내는 사람", `${box.senderCount}명`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-text-faint">{label}</dt>
                    <dd className="text-right text-text">{value}</dd>
                  </div>
                ))}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button type="button" className={pill} onClick={() => setEditing(box.id)}>
                    이름·받는 분 고치기
                  </button>
                  <button type="button" className={pill} onClick={() => setConfiguring(box.id)}>
                    세부 설정
                  </button>
                </div>
              </dl>

              <section aria-label="함께 보내는 사람" className="flex flex-col gap-2 rounded-2xl bg-surface p-5 ring-1 ring-line">
                <h3 className="text-[15px] font-semibold text-text">함께 보내는 사람</h3>
                <p className="text-[13px] leading-relaxed text-text-muted">
                  형제처럼 이 사진첩에 같이 엽서를 보낼 가족을 초대해요. 초대 링크는 {INVITE_DAYS}일 안에 한 번만 쓸 수 있고, 한 사진첩에 {MAILBOX_SENDER_LIMIT}명까지 들일 수 있어요.
                </p>
                <button type="button" className={`${pill} self-start`} disabled={busy || box.closed} onClick={() => void invite(box)}>
                  보내는 사람 초대
                </button>
                {boxInvites.length > 0 && (
                  <ul className="flex flex-col gap-1.5" aria-label={`${box.name} 보내는 사람 초대`}>
                    {boxInvites.map((entry) => (
                      <li key={entry.token} className="flex flex-col gap-1.5 rounded-lg bg-accent-soft p-2.5">
                        <p className="text-[13px] font-medium text-text">
                          보내는 사람 초대 링크 · {new Date(entry.expiresAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}까지
                        </p>
                        {freshInvite === entry.token && (
                          <input
                            readOnly
                            value={mailboxInviteUrl(window.location.origin, entry.token)}
                            aria-label="보내는 사람 초대 링크"
                            onFocus={(event) => event.currentTarget.select()}
                            className="w-full rounded-lg bg-bg px-3 py-2 text-[13px] text-text ring-1 ring-line"
                          />
                        )}
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className={pill}
                            onClick={() => void copy(mailboxInviteUrl(window.location.origin, entry.token), "초대 링크를 복사했어요. 함께 엽서를 보낼 가족에게 보내 주세요.")}
                          >
                            복사
                          </button>
                          <button type="button" className={pill} disabled={busy} onClick={() => void cancelInvite(entry.token)}>
                            취소
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-label="링크와 사진첩 관리" className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
                <h3 className="text-[15px] font-semibold text-text">링크 · 관리</h3>
                {asking === `rotate-${box.id}` ? (
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-text">옛 링크는 바로 열리지 않게 돼요. 받는 분께 새 링크를 다시 보내야 해요.</span>
                    <button type="button" disabled={busy} onClick={() => void rotate(box)} className="rounded-full bg-text px-3.5 py-1.5 font-medium text-bg">
                      새로 만들기
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="text-text-muted">
                      그만두기
                    </button>
                  </div>
                ) : asking === `close-${box.id}` ? (
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-text">닫으면 받는 분에게 아무것도 보이지 않아요. 언제든 다시 열 수 있어요.</span>
                    <button type="button" disabled={busy} onClick={() => void toggleClosed(box)} className="rounded-full bg-text px-3.5 py-1.5 font-medium text-bg">
                      닫기
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="text-text-muted">
                      그만두기
                    </button>
                  </div>
                ) : asking === `delete-${box.id}` && deletePlan?.id === box.id ? (
                  <div className="flex flex-col gap-2 rounded-lg bg-bg-subtle p-3 text-[13px] leading-relaxed">
                    <p className="font-medium text-text">
                      ‘{box.name}’ 사진첩을 지울까요?{" "}
                      {deletePlan.sole > 0
                        ? `이 사진첩에만 보낸 엽서 ${deletePlan.sole}장과 그 사진 복사본·답장·하트가 모두 지워지고 되돌릴 수 없어요.`
                        : "이 사진첩에만 보낸 엽서는 없어요. 받은 답장·하트와 보내는 사람 초대가 지워지고 되돌릴 수 없어요."}
                    </p>
                    {deletePlan.kept > 0 && <p className="text-text-muted">다른 사진첩에도 보낸 엽서 {deletePlan.kept}장은 그쪽에 그대로 남아요.</p>}
                    <p className="text-text-muted">내 여행과 원본 사진은 그대로예요. 받는 분의 링크는 다시 열리지 않아요.</p>
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={busy} onClick={() => void removeBox(box)} className="rounded-full bg-[#d70015] px-3.5 py-1.5 font-medium text-white disabled:opacity-60">
                        지우기
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAsking(null);
                          setDeletePlan(null);
                        }}
                        className="text-text-muted"
                      >
                        그만두기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 text-[14px] font-medium text-text-muted">
                    <button type="button" disabled={box.closed} onClick={() => setAsking(`rotate-${box.id}`)} className="hover:text-text disabled:opacity-50">
                      링크 새로 만들기
                    </button>
                    {box.closed ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void toggleClosed(box)} className="hover:text-text">
                          다시 열기
                        </button>
                        <button type="button" disabled={busy} onClick={() => void askDelete(box)} className="text-[#d70015] hover:opacity-80">
                          사진첩 지우기
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setAsking(`close-${box.id}`)} className="hover:text-text">
                        사진첩 닫기
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[12px] leading-relaxed text-text-faint">링크가 퍼졌다면 ‘링크 새로 만들기’로 옛 링크를 끊을 수 있어요.</p>
              </section>
            </div>
          )}
        </div>
      </div>
    );
  };

  /** 사진첩 목록 — 표지가 있는 카드. 설정 같은 세부는 카드를 열어야 보인다. */
  const listView = () => (
    <>
      <Section
        title={`내 사진첩 ${openCount}/${MAILBOX_LIMIT}`}
        note="받는 분 한 집에 사진첩 하나예요. 부모님 두 분은 한 사진첩에서 같이 받고, 링크 하나로 열어요. 로그인은 필요 없어요."
      >
        {list.owned.length === 0 && !creating && <p className="text-[14px] text-text-faint">아직 없어요. 사진첩을 만들어 부모님께 여행을 보여 드려요.</p>}

        <ul className="flex flex-col gap-2.5">
          {list.owned.map((box) => {
            const cover = coverOf(box);
            const letters = lettersOf(box);
            const news = freshCount(box);
            const unopened = letters.some((card) => card.deliveries.some((delivery) => delivery.mailboxId === box.id && !delivery.opened));
            return (
              <li key={box.id}>
                <button
                  type="button"
                  onClick={() => show(box.id)}
                  aria-label={`${box.name} 열기`}
                  data-closed={box.closed ? "true" : undefined}
                  className={`flex w-full items-center gap-4 rounded-2xl p-3.5 text-left ring-1 ring-line transition hover:bg-bg-subtle ${box.closed ? "bg-bg-subtle" : "bg-surface"}`}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 엽서 보관함의 공개 주소라 미리 최적화할 수 없다
                    <img src={cover} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-accent-soft text-[28px] text-accent">
                      ✉
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[16px] font-semibold text-text">{box.name}</span>
                    <span className="truncate text-[13px] text-text-muted">
                      받는 분 {box.members.length > 0 ? box.members.join(" · ") : "—"}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-faint">
                      엽서 {letters.length}장
                      {box.closed && <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-[12px] text-text-muted">닫혀 있어요</span>}
                      {news > 0 && <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">새 소식 {news}</span>}
                      {news === 0 && unopened && <span className="text-[12px]">아직 안 열어 보셨어요</span>}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-[20px] text-text-faint">
                    ›
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {creating ? (
          <FirstShelfForm
            busy={busy}
            error={null}
            heading="새 사진첩 만들기"
            intro="받는 분 이름과 말투만 알려 주세요. 나머지는 저절로 정해져요."
            question="누구에게 보여 드릴까요?"
            submitLabel="사진첩 만들기"
            footnote="이름·사진 장수 같은 세부 설정은 만든 뒤 ‘설정’에서 바꿀 수 있어요."
            onSubmit={(answer) => void createFirst(answer)}
            onCancel={() => setCreating(false)}
          />
        ) : full ? (
          <p className="text-[14px] text-text-muted">사진첩은 {MAILBOX_LIMIT}개까지 열어 둘 수 있어요. 하나를 닫으면 새로 만들 수 있어요.</p>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-2xl bg-surface px-5 py-4 text-[15px] font-semibold text-accent ring-1 ring-line transition hover:bg-bg-subtle"
          >
            + 새 사진첩
          </button>
        )}
      </Section>

      {list.joined.length > 0 && (
        <Section title="보내는 사람으로 들어간 사진첩" note="다른 가족이 만든 사진첩이에요. 이곳에도 엽서를 보낼 수 있어요.">
          <ul className="flex flex-col gap-2">
            {list.joined.map((box) => (
              <li
                key={box.id}
                data-closed={box.closed ? "true" : undefined}
                className={`flex flex-col gap-2 rounded-2xl px-4 py-3.5 ring-1 ring-line ${box.closed ? "bg-bg-subtle" : "bg-surface"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">{box.name}</span>
                  {box.closed && <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-[12px] text-text-muted">닫혀 있어요</span>}
                </div>
                <p className="text-[13px] text-text-muted">받는 분 {box.members.join(" · ") || "—"} · 보내는 사람 {box.senderCount}명</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={pill} disabled={box.closed} onClick={() => void copy(mailboxUrl(window.location.origin, box.token), "사진첩 링크를 복사했어요.")}>
                    링크 복사
                  </button>
                  <Preview box={box} />
                  {asking === `leave-${box.id}` ? (
                    <>
                      <span className="text-[13px] text-text">나가면 이 사진첩에 엽서를 보낼 수 없어요.</span>
                      <button type="button" disabled={busy} onClick={() => void leave(box)} className="rounded-full bg-text px-3.5 py-1.5 text-[13px] font-medium text-bg">
                        나가기
                      </button>
                      <button type="button" onClick={() => setAsking(null)} className="text-[13px] text-text-muted">
                        그만두기
                      </button>
                    </>
                  ) : (
                    <button type="button" className={pill} onClick={() => setAsking(`leave-${box.id}`)}>
                      나가기
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sent.length > 0 && (
        // 사진첩마다의 엽서는 그 사진첩 안에 있다. 여기는 내가 보낸 모든 엽서를 한곳에서 보거나 거두고 싶을 때(남의 사진첩으로 보낸 것 포함).
        <details className="group rounded-2xl bg-surface p-5 ring-1 ring-line" data-all-sent="">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[16px] font-semibold text-text [&::-webkit-details-marker]:hidden">
            <span>보낸 엽서 {sent.length}장 모두 보기</span>
            <span aria-hidden="true" className="text-[12px] text-text-faint transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
            받는 분이 열어 봤는지, 답장했는지 볼 수 있어요. 엽서는 보낸 순간 그대로 남고, 거두면 모든 사진첩에서 사라져요.
          </p>
          <ul className="mt-3 flex flex-col gap-2">{sent.map((card) => sentCard(card))}</ul>
        </details>
      )}
    </>
  );

  // 열려 있는 사진첩(없는 id 면 목록으로).
  const opened = openId ? (list.owned.find((box) => box.id === openId) ?? null) : null;

  return (
    <div className="flex flex-col gap-5">
      {message && (
        // 목록이 길어 아래쪽 카드의 단추를 누르면 맨 위의 알림이 화면 밖이다. 아무 일도 안 일어난 것처럼 보이지 않게 위 띠 아래에 붙인다.
        <p role="status" className="sticky top-[4.25rem] z-20 break-all rounded-2xl bg-surface px-4 py-3 text-[14px] text-text shadow-md ring-1 ring-line">
          {message}
        </p>
      )}

      {opened && configuring === opened.id ? (
        <article aria-label={`${opened.name} 설정`} className="flex flex-col gap-2.5 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h3 className="truncate text-[16px] font-semibold text-text">{opened.name} · 설정</h3>
          <MailboxSettingsEditor
            initial={opened.settings}
            busy={busy}
            onSave={(settings) => void saveSettings(opened.id, settings)}
            onCancel={() => setConfiguring(null)}
          />
        </article>
      ) : opened && editing === opened.id ? (
        <MailboxForm
          initial={{
            name: opened.name,
            greetingName: opened.greetingName ?? "",
            members: opened.members.join(", "),
            tone: opened.tone,
            useGreeting: opened.useGreeting,
          }}
          submitLabel="저장"
          busy={busy}
          onSubmit={(input) => void edit(opened.id, input)}
          onCancel={() => setEditing(null)}
        />
      ) : opened ? (
        detailView(opened)
      ) : (
        listView()
      )}
    </div>
  );
}
