"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  cancelInvite,
  changeRole,
  createInvite,
  fetchCircle,
  fetchInvites,
  inviteUrl,
  removeLink,
  type Circle,
  type PendingInvite,
} from "@/lib/supabase/family";
import { FAMILY_LIMIT, FAMILY_ROLES, INVITE_DAYS, roleHint, roleLabel, type FamilyRole } from "@/lib/family";

/*
  가족 공유 — 내 여행을 함께 볼 사람을 들이고, 권한을 정하고, 끊는다.

  위에서부터: 초대하기 → 내가 들인 가족 → 나에게 열어 준 사람.
  권한을 고르는 말은 "무엇을 할 수 있나"가 한눈에 들어오게 적는다. 끊는 일은 되돌릴 수
  없으니 한 번 더 묻는다(초대 링크는 취소하면 그 링크가 바로 죽는다).
*/

type Loaded = { userId: string; circle: Circle; invites: PendingInvite[] };

function RolePicker({
  value,
  onChange,
  name,
  disabled,
}: {
  value: FamilyRole;
  onChange: (role: FamilyRole) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="권한" className="flex flex-col gap-1.5">
      {FAMILY_ROLES.map((role) => (
        <label
          key={role}
          className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5 ring-1 transition ${
            role === value ? "bg-accent-soft ring-accent" : "bg-bg ring-line hover:bg-bg-subtle"
          } ${disabled ? "opacity-60" : ""}`}
        >
          <input
            type="radio"
            name={name}
            value={role}
            checked={role === value}
            disabled={disabled}
            onChange={() => onChange(role)}
            className="mt-1"
          />
          <span className="flex flex-col">
            <span className="text-[15px] font-semibold text-text">{roleLabel(role)}</span>
            <span className="text-[13px] text-text-muted">{roleHint(role)}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

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

export function FamilyPanel() {
  const [state, setState] = useState<Loaded | "loading" | "login" | "failed">("loading");
  const [role, setRole] = useState<FamilyRole>("view");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** 방금 만든 초대(바로 복사할 수 있게 위에 크게 보여 준다). */
  const [fresh, setFresh] = useState<string | null>(null);
  /** 해제·나가기를 한 번 더 묻는 중인 줄(상대 id). */
  const [asking, setAsking] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getBrowserClient();
    if (!supabase) return setState("failed");
    const { data } = await supabase.auth.getUser();
    if (!data.user) return setState("login");
    const [circle, invites] = await Promise.all([fetchCircle(supabase), fetchInvites(supabase, data.user.id)]);
    if (circle === "failed" || invites === "failed") return setState("failed");
    setState({ userId: data.user.id, circle, invites });
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
        가족 공유는 로그인해야 쓸 수 있어요.{" "}
        <Link href="/login?next=/family" className="font-medium text-accent hover:text-accent-hover">
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

  const { userId, circle, invites } = state;
  const full = circle.owned.length >= FAMILY_LIMIT;

  /** 무엇을 하든 끝나면 목록을 다시 받는다. 실패는 한 줄로 알린다. */
  const run = async (task: (supabase: NonNullable<ReturnType<typeof getBrowserClient>>) => Promise<boolean>, failure: string) => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const ok = await task(supabase);
    if (!ok) setMessage(failure);
    await load();
    setBusy(false);
  };

  const makeInvite = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const token = await createInvite(supabase, userId, role);
    if (token === "failed") setMessage("초대를 만들지 못했어요. 잠시 뒤 다시 해 주세요.");
    else setFresh(token);
    await load();
    setBusy(false);
  };

  const copy = async (token: string) => {
    const url = inviteUrl(window.location.origin, token);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요. 가족에게 보내 주세요.");
    } catch {
      // 복사가 막힌 브라우저에서는 보이는 주소를 직접 고르게 둔다.
      setMessage("복사하지 못했어요. 아래 주소를 눌러 직접 복사해 주세요.");
    }
  };

  const freshInvite = fresh ? invites.find((invite) => invite.token === fresh) : undefined;

  return (
    <div className="flex flex-col gap-5">
      {message && (
        <p role="status" className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          {message}
        </p>
      )}

      <Section
        title="가족 초대하기"
        note={`초대 링크를 받은 가족이 로그인해서 수락하면 내 여행을 함께 볼 수 있어요. 링크는 ${INVITE_DAYS}일 안에 한 번만 쓸 수 있어요.`}
      >
        {full ? (
          <p className="text-[14px] text-text-muted">가족은 {FAMILY_LIMIT}명까지 들일 수 있어요. 한 명을 해제하면 다시 초대할 수 있어요.</p>
        ) : (
          <>
            <RolePicker value={role} onChange={setRole} name="new-role" disabled={busy} />
            <button
              type="button"
              onClick={() => void makeInvite()}
              disabled={busy}
              className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              초대 링크 만들기
            </button>
          </>
        )}

        {freshInvite && (
          <div className="flex flex-col gap-2 rounded-xl bg-accent-soft p-3">
            <p className="text-[14px] font-semibold text-text">
              {roleLabel(freshInvite.role)} 초대 링크가 만들어졌어요
            </p>
            <input
              readOnly
              value={inviteUrl(window.location.origin, freshInvite.token)}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="초대 링크"
              className="w-full rounded-lg bg-bg px-3 py-2 text-[13px] text-text ring-1 ring-line"
            />
            <button
              type="button"
              onClick={() => void copy(freshInvite.token)}
              className="self-start rounded-full bg-text px-4 py-2 text-[14px] font-medium text-bg"
            >
              링크 복사
            </button>
          </div>
        )}

        {invites.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="아직 수락 전인 초대">
            {invites.map((invite) => (
              <li key={invite.token} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 ring-1 ring-line">
                <span className="min-w-0 flex-1 text-[14px] text-text">
                  {roleLabel(invite.role)}
                  <span className="ml-2 text-[13px] text-text-faint">
                    {new Date(invite.expiresAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}까지
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void copy(invite.token)}
                  className="rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text hover:bg-line"
                >
                  복사
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (fresh === invite.token) setFresh(null);
                    void run((supabase) => cancelInvite(supabase, invite.token), "초대를 취소하지 못했어요.");
                  }}
                  className="rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text-muted hover:bg-line"
                >
                  취소
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={`내가 들인 가족 ${circle.owned.length}/${FAMILY_LIMIT}`}
        note="이 사람들은 내 여행을 볼 수 있어요. 권한은 언제든 바꾸거나 해제할 수 있어요."
      >
        {circle.owned.length === 0 ? (
          <p className="text-[14px] text-text-faint">아직 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {circle.owned.map((member) => (
              <li key={member.id} className="flex flex-col gap-2.5 rounded-xl bg-bg p-3 ring-1 ring-line">
                <p className="truncate text-[15px] font-semibold text-text">{member.email ?? "알 수 없는 계정"}</p>
                <RolePicker
                  value={member.role}
                  name={`role-${member.id}`}
                  disabled={busy}
                  onChange={(next) =>
                    void run((supabase) => changeRole(supabase, userId, member.id, next), "권한을 바꾸지 못했어요.")
                  }
                />
                {asking === member.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-text">해제하면 바로 내 여행을 볼 수 없어요.</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAsking(null);
                        void run((supabase) => removeLink(supabase, userId, member.id), "해제하지 못했어요.");
                      }}
                      className="rounded-full bg-text px-3.5 py-1.5 text-[13px] font-medium text-bg"
                    >
                      해제
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="text-[13px] text-text-muted">
                      그만두기
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAsking(member.id)}
                    className="self-start text-[13px] font-medium text-text-muted hover:text-text"
                  >
                    가족에서 해제
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {circle.shared.length > 0 && (
        <Section title="나에게 열어 준 사람" note="이 사람들이 자기 여행을 내게 열어 줬어요.">
          <ul className="flex flex-col gap-2">
            {circle.shared.map((member) => (
              <li key={member.id} className="flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 ring-1 ring-line">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-text">{member.email ?? "알 수 없는 계정"}</span>
                  <span className="text-[13px] text-text-muted">{roleLabel(member.role)}</span>
                </span>
                {asking === `leave-${member.id}` ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAsking(null);
                        void run((supabase) => removeLink(supabase, member.id, userId), "나가지 못했어요.");
                      }}
                      className="rounded-full bg-text px-3.5 py-1.5 text-[13px] font-medium text-bg"
                    >
                      나가기
                    </button>
                    <button type="button" onClick={() => setAsking(null)} className="text-[13px] text-text-muted">
                      그만두기
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAsking(`leave-${member.id}`)}
                    className="rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text-muted hover:bg-line"
                  >
                    나가기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
