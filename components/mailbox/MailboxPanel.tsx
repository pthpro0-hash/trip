"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  cancelMailboxInvite,
  createMailbox,
  createMailboxInvite,
  deleteMailbox,
  fetchMailboxInvites,
  fetchMailboxes,
  leaveMailbox,
  planMailboxDelete,
  rotateMailboxToken,
  setMailboxClosed,
  updateMailbox,
  updateMailboxSettings,
  type MailboxInput,
  type MailboxItem,
  type MailboxList,
  type PendingMailboxInvite,
} from "@/lib/supabase/mailbox";
import { fetchSentPostcards, markHeartsSeen, markRepliesSeen, withdrawPostcard, type SentPostcard } from "@/lib/supabase/postcards";
import { summarizeHearts, type HeartLine } from "@/lib/mailboxHearts";
import { attachParticle } from "@/lib/korean";
import type { MailboxSettings } from "@/lib/mailboxSettings";
import { REPLIES_SEEN } from "./MailboxBell";
import { MAILBOX_LIMIT, MAILBOX_SENDER_LIMIT, mailboxInviteUrl, mailboxPath, mailboxUrl } from "@/lib/mailbox";
import { INVITE_DAYS } from "@/lib/family";
import { MailboxForm } from "./MailboxForm";
import { MailboxSettingsEditor } from "./MailboxSettingsEditor";

/*
  내 우편함 — 집 한 곳당 하나. 부모님 두 분은 한 우편함에서 같이 받는다.

  위에서부터: 내가 만든 우편함(만들기·고치기·링크·보내는 사람 초대·닫기·지우기) → 보내는 사람으로 들어간 우편함.
  되돌릴 수 없는 일(링크 새로 만들기, 닫기, 지우기, 나가기)은 한 번 더 묻는다. 지우기는 닫은 우편함에만 있다 —
  닫기(되돌릴 수 있다) → 지우기(되돌릴 수 없다) 두 단계라 실수로 지우기 어렵다.
*/

type Loaded = { userId: string; list: MailboxList; invites: PendingMailboxInvite[]; sent: SentPostcard[] };

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

/** 하트를 어디에 눌렀는지 — "사진 2장에", "이 여행에", "이 여행과 사진 2장에". */
function heartTarget(line: HeartLine): string {
  if (line.book && line.photos > 0) return `이 여행과 사진 ${line.photos}장에`;
  if (line.book) return "이 여행에";
  return `사진 ${line.photos}장에`;
}

/**
 * 부모님 화면을 미리 본다(새 탭). 받는 쪽 화면 그대로이되 "열어 봤다" 표시·답장·하트는 가지 않는다.
 * 닫은 우편함은 부모님께 아무것도 안 보이니 미리볼 것도 없다.
 */
function Preview({ box }: { box: MailboxItem }) {
  if (box.closed) {
    return (
      <button type="button" className={pill} disabled>
        부모님 화면 보기
      </button>
    );
  }
  return (
    <a href={mailboxPath(box.token, true)} target="_blank" rel="noopener noreferrer" className={pill}>
      부모님 화면 보기
    </a>
  );
}

export function MailboxPanel() {
  const [state, setState] = useState<Loaded | "loading" | "login" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** 만들기 칸이 열려 있나, 고치는 중인 우편함 id. */
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** 설정 칸이 열려 있는 우편함 id. */
  const [configuring, setConfiguring] = useState<string | null>(null);
  /** 한 번 더 묻는 중인 일("rotate-<id>", "close-<id>", "leave-<id>"). */
  const [asking, setAsking] = useState<string | null>(null);
  /** 지우기 확인 창이 말할 숫자 — 이 우편함에만 보낸 엽서(지워진다)와 다른 우편함에도 가서 남는 엽서. */
  const [deletePlan, setDeletePlan] = useState<{ id: string; sole: number; kept: number } | null>(null);
  /** 방금 만든 보내는 사람 초대의 글자(바로 복사할 수 있게 크게 보여 준다). */
  const [freshInvite, setFreshInvite] = useState<string | null>(null);
  /*
    이번에 처음 본 답장·하트들. 화면을 열면 답장을 "봤다"고 표시하는데, 그 순간 "새 답장" 표시까지 사라지면
    무엇이 새것인지 알 수 없다. 이 화면에 머무는 동안은 새것으로 남겨 둔다(다른 일로 목록을 다시 받아도).
  */
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return setState("failed");
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setState("login");
    const [list, invites, sent] = await Promise.all([
      fetchMailboxes(supabase, data.user.id),
      fetchMailboxInvites(supabase, data.user.id),
      // 보낸 엽서는 곁다리다. 못 읽어도 우편함 관리는 된다.
      fetchSentPostcards(supabase, data.user.id).catch(() => []),
    ]);
    if (list === "failed" || invites === "failed") return setState("failed");
    setState({ userId: data.user.id, list, invites, sent });

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
        가족 우편함은 로그인해야 쓸 수 있어요.{" "}
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

  const { userId, list, invites, sent } = state;
  const nameOf = new Map([...list.owned, ...list.joined].map((box) => [box.id, box.name]));
  const openCount = list.owned.filter((box) => !box.closed).length;
  const full = openCount >= MAILBOX_LIMIT;

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

  const create = (input: MailboxInput) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const result = await createMailbox(supabase, userId, input);
      if (result.ok) {
        setCreating(false);
        return null;
      }
      if (result.reason === "limit") return `우편함은 ${MAILBOX_LIMIT}개까지 열어 둘 수 있어요.`;
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
        ? `열려 있는 우편함이 이미 ${MAILBOX_LIMIT}개예요. 하나를 닫고 다시 열어 주세요.`
        : "바꾸지 못했어요.";
    });

  /** 지우기 전에 무엇이 지워지는지 읽어 와 한 번 더 묻는다. 못 읽으면 모르는 채로 지우게 하지 않는다. */
  const askDelete = (box: MailboxItem) =>
    run(async () => {
      const supabase = getBrowserClient();
      if (!supabase) return "지금은 쓸 수 없어요.";
      const plan = await planMailboxDelete(supabase, box.id);
      if (!plan) return "지울 내용을 읽지 못했어요. 잠시 뒤 다시 해 주세요.";
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
        return "우편함을 지웠어요.";
      }
      // 못 지웠으면 확인 창을 그대로 둔다 — 다시 누르면 된다.
      return result === "files"
        ? "사진을 모두 지우지 못했어요. 우편함은 그대로 있어요. 잠시 뒤 다시 해 주세요."
        : "우편함을 지우지 못했어요. 잠시 뒤 다시 해 주세요.";
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

  return (
    <div className="flex flex-col gap-5">
      {message && (
        <p role="status" className="break-all rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          {message}
        </p>
      )}

      <Section
        title={`내 우편함 ${openCount}/${MAILBOX_LIMIT}`}
        note="집 한 곳당 하나예요. 부모님 두 분은 한 우편함에서 같이 받아요. 받는 분은 링크 하나로 열고, 로그인은 필요 없어요."
      >
        {list.owned.length === 0 && !creating && <p className="text-[14px] text-text-faint">아직 없어요.</p>}

        {list.owned.map((box) => {
          const boxInvites = invites.filter((entry) => entry.mailboxId === box.id);
          if (configuring === box.id) {
            return (
              <article key={box.id} aria-label={`${box.name} 설정`} className="flex flex-col gap-2.5">
                <h3 className="truncate text-[16px] font-semibold text-text">{box.name} · 설정</h3>
                <MailboxSettingsEditor
                  initial={box.settings}
                  busy={busy}
                  onSave={(settings) => void saveSettings(box.id, settings)}
                  onCancel={() => setConfiguring(null)}
                />
              </article>
            );
          }
          if (editing === box.id) {
            return (
              <MailboxForm
                key={box.id}
                initial={{
                  name: box.name,
                  greetingName: box.greetingName ?? "",
                  members: box.members.join(", "),
                  tone: box.tone,
                  useGreeting: box.useGreeting,
                }}
                submitLabel="저장"
                busy={busy}
                onSubmit={(input) => void edit(box.id, input)}
                onCancel={() => setEditing(null)}
              />
            );
          }
          return (
            <article
              key={box.id}
              aria-label={box.name}
              // 닫은 우편함은 바탕색을 달리해 한눈에 구분한다(받는 쪽에는 아무것도 안 보이는 상태).
              data-closed={box.closed ? "true" : undefined}
              className={`flex flex-col gap-2.5 rounded-xl p-3.5 ring-1 ring-line ${box.closed ? "bg-bg-subtle" : "bg-bg"}`}
            >
              <div className="flex items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-text">{box.name}</h3>
                {box.closed && <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-[12px] text-text-muted">닫혀 있어요</span>}
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[12px] text-accent">{TONE_LABEL[box.tone]}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-text-muted">
                받는 분 {box.members.length > 0 ? box.members.join(" · ") : "—"}
                {box.greetingName && box.useGreeting && <> · 부르는 말 &lsquo;{box.greetingName}&rsquo;</>}
                <br />
                보내는 사람 {box.senderCount}명 · 책 한 권 사진 {box.settings.photos}장
              </p>

              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={pill} disabled={box.closed} onClick={() => void copy(mailboxUrl(window.location.origin, box.token), "받는 분께 보낼 우편함 링크를 복사했어요.")}>
                  링크 복사
                </button>
                <Preview box={box} />
                <button type="button" className={pill} onClick={() => setEditing(box.id)}>
                  고치기
                </button>
                <button type="button" className={pill} onClick={() => setConfiguring(box.id)}>
                  설정
                </button>
                <button type="button" className={pill} disabled={busy || box.closed} onClick={() => void invite(box)}>
                  보내는 사람 초대
                </button>
              </div>

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
                    ‘{box.name}’ 우편함을 지울까요?{" "}
                    {deletePlan.sole > 0
                      ? `이 우편함에만 보낸 엽서 ${deletePlan.sole}장과 그 사진 복사본·답장·하트가 모두 지워지고 되돌릴 수 없어요.`
                      : "이 우편함에만 보낸 엽서는 없어요. 받은 답장·하트와 보내는 사람 초대가 지워지고 되돌릴 수 없어요."}
                  </p>
                  {deletePlan.kept > 0 && <p className="text-text-muted">다른 우편함에도 보낸 엽서 {deletePlan.kept}장은 그쪽에 그대로 남아요.</p>}
                  <p className="text-text-muted">내 여행과 원본 사진은 그대로예요. 받는 분의 링크는 다시 열리지 않아요.</p>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busy} onClick={() => void removeBox(box)} className="rounded-full bg-[#d70015] px-3.5 py-1.5 font-medium text-white disabled:opacity-60">
                      지우기
                    </button>
                    <button type="button" onClick={() => { setAsking(null); setDeletePlan(null); }} className="text-text-muted">
                      그만두기
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 text-[13px] font-medium text-text-muted">
                  <button type="button" disabled={box.closed} onClick={() => setAsking(`rotate-${box.id}`)} className="hover:text-text disabled:opacity-50">
                    링크 새로 만들기
                  </button>
                  {box.closed ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => void toggleClosed(box)} className="hover:text-text">
                        다시 열기
                      </button>
                      <button type="button" disabled={busy} onClick={() => void askDelete(box)} className="text-[#d70015] hover:opacity-80">
                        우편함 지우기
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setAsking(`close-${box.id}`)} className="hover:text-text">
                      우편함 닫기
                    </button>
                  )}
                </div>
              )}

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
            </article>
          );
        })}

        {creating ? (
          <MailboxForm submitLabel="우편함 만들기" busy={busy} onSubmit={(input) => void create(input)} onCancel={() => setCreating(false)} />
        ) : full ? (
          <p className="text-[14px] text-text-muted">우편함은 {MAILBOX_LIMIT}개까지 열어 둘 수 있어요. 하나를 닫으면 새로 만들 수 있어요.</p>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            우편함 만들기
          </button>
        )}

        {list.owned.some((box) => !box.closed) && (
          <p className="text-[12px] leading-relaxed text-text-faint">
            보내는 사람 초대는 {INVITE_DAYS}일 안에 한 번만 쓸 수 있고, 한 우편함에 {MAILBOX_SENDER_LIMIT}명까지 들일 수 있어요.
            링크가 퍼졌다면 &lsquo;링크 새로 만들기&rsquo;로 옛 링크를 끊을 수 있어요.
          </p>
        )}
      </Section>

      {sent.length > 0 && (
        <Section
          title={`보낸 엽서 ${sent.length}장`}
          note="받는 분이 열어 봤는지, 답장했는지 볼 수 있어요. 엽서는 보낸 순간 그대로 남고, 거두면 모든 우편함에서 사라져요."
        >
          <ul className="flex flex-col gap-2">
            {sent.map((card) => (
              <li key={card.id} className="flex flex-col gap-1.5 rounded-xl bg-bg px-3.5 py-3 ring-1 ring-line">
                <p className="text-[15px] font-semibold text-text">
                  {card.title || "제목 없는 여행"}
                  <span className="ml-2 text-[13px] font-normal text-text-faint">
                    {card.startedOn ? new Date(card.startedOn).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : ""}
                  </span>
                </p>
                <ul className="flex flex-col gap-0.5 text-[13px] text-text-muted">
                  {card.deliveries.map((delivery) => (
                    <li key={delivery.mailboxId}>
                      {nameOf.get(delivery.mailboxId) ?? "우편함"} ·{" "}
                      <span className={delivery.opened ? "text-accent" : ""}>
                        {delivery.opened ? "열어 보셨어요" : "아직 안 열어 보셨어요"}
                      </span>
                    </li>
                  ))}
                </ul>
                {card.replies.length > 0 && (
                  <ul className="flex flex-col gap-1" aria-label={`${card.title || "여행"} 답장`}>
                    {card.replies.map((reply) => (
                      <li key={reply.id} className="flex flex-wrap items-center gap-1.5 text-[14px] text-text">
                        <span aria-hidden="true">💬</span>
                        <span>
                          {attachParticle(reply.who, "이", "가")} &lsquo;{reply.reaction}&rsquo; 하셨어요
                        </span>
                        {card.deliveries.length > 1 && (
                          <span className="text-[12px] text-text-faint">· {nameOf.get(reply.mailboxId) ?? "우편함"}</span>
                        )}
                        {fresh.has(reply.id) && (
                          <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">새 답장</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {card.hearts.length > 0 && (
                  <ul className="flex flex-col gap-1" aria-label={`${card.title || "여행"} 하트`}>
                    {summarizeHearts(card.hearts).map((line) => (
                      <li key={`${line.mailboxId}|${line.who}`} className="flex flex-wrap items-center gap-1.5 text-[14px] text-text">
                        <span aria-hidden="true" className="text-[#e0245e]">
                          ♥
                        </span>
                        <span>
                          {attachParticle(line.who, "이", "가")} {heartTarget(line)} 하트를 눌렀어요
                        </span>
                        {card.deliveries.length > 1 && (
                          <span className="text-[12px] text-text-faint">· {nameOf.get(line.mailboxId) ?? "우편함"}</span>
                        )}
                        {line.ids.some((id) => fresh.has(id)) && (
                          <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">새 하트</span>
                        )}
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
            ))}
          </ul>
        </Section>
      )}

      {list.joined.length > 0 && (
        <Section title="보내는 사람으로 들어간 우편함" note="다른 가족이 만든 우편함이에요. 이곳에도 엽서를 보낼 수 있어요.">
          <ul className="flex flex-col gap-2">
            {list.joined.map((box) => (
              <li
                key={box.id}
                data-closed={box.closed ? "true" : undefined}
                className={`flex flex-col gap-2 rounded-xl px-3.5 py-3 ring-1 ring-line ${box.closed ? "bg-bg-subtle" : "bg-bg"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text">{box.name}</span>
                  {box.closed && <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-[12px] text-text-muted">닫혀 있어요</span>}
                </div>
                <p className="text-[13px] text-text-muted">받는 분 {box.members.join(" · ") || "—"} · 보내는 사람 {box.senderCount}명</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className={pill} disabled={box.closed} onClick={() => void copy(mailboxUrl(window.location.origin, box.token), "우편함 링크를 복사했어요.")}>
                    링크 복사
                  </button>
                  <Preview box={box} />
                  {asking === `leave-${box.id}` ? (
                    <>
                      <span className="text-[13px] text-text">나가면 이 우편함에 엽서를 보낼 수 없어요.</span>
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
    </div>
  );
}
