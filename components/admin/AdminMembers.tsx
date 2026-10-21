"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  fetchMembers,
  logAccountView,
  setMemberGrade,
  type AdminMember,
  type MemberSort,
} from "@/lib/supabase/grade";
import { GRADES, gradeLabel, limitLabel, limitOf, type Grade } from "@/lib/grade";
import { startFamilyView } from "@/lib/familyView";

/*
  관리자 — 회원 목록. 이메일로 찾고, 최근 가입·사진 많은 순으로 늘어놓는다.

  등급은 고른 뒤 한 번 더 묻고 바꾼다(바꾼 일은 DB 에 기록된다, supabase/admin.sql). "이 계정 보기"는 그 사람의 여행을 그 사람
  화면 그대로 보기만 한다 — 가족 여행 보기와 같은 길(lib/familyView)에 관리자 표시를 달아 연다. 열기 전에 기록을 남기고, 남기지
  못하면 열지 않는다.
*/

const day = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll("-", ".") : "—");

function MemberRow({ member, onChanged }: { member: AdminMember; onChanged: () => void }) {
  const [asking, setAsking] = useState<Grade | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "failed" | "viewFailed">("idle");
  const limit = limitOf(member.grade);
  const ratio = limit === null ? 0 : Math.min(1, member.photoCount / Math.max(1, limit));
  const name = member.email ?? "(이메일 없음)";

  const change = async (grade: Grade) => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setState("saving");
    const ok = await setMemberGrade(supabase, member.id, grade);
    setState(ok ? "idle" : "failed");
    setAsking(null);
    if (ok) onChanged();
  };

  const view = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    if (!(await logAccountView(supabase, member.id))) {
      setState("viewFailed");
      return;
    }
    startFamilyView({ ownerId: member.id, label: name, role: "view", admin: true });
    // 화면 전체를 새로 불러 그 사람의 여행으로 연다(앞 화면의 자료가 남지 않게).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/?v=sketch";
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 break-all text-[15px] font-semibold text-text">{name}</p>
        <p className="shrink-0 text-[12px] text-text-faint">
          가입 {day(member.createdAt)} · 접속 {day(member.lastSignInAt)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[13px] text-text-muted">
          여행 {member.tripCount.toLocaleString("ko-KR")}건 · 사진 {member.photoCount.toLocaleString("ko-KR")} / {limitLabel(limit)}
          {member.pendingTo !== null && (
            <span className="ml-2 rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">
              등업 신청 {limitLabel(limitOf(member.pendingTo))}
            </span>
          )}
        </p>
        {limit !== null && (
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle" aria-hidden="true">
            <div className={`h-full rounded-full ${ratio >= 1 ? "bg-[#d70015]" : "bg-accent"}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`${name} 등급`}
          value={asking ?? member.grade}
          disabled={state === "saving"}
          onChange={(event) => {
            const next = Number(event.target.value) as Grade;
            setAsking(next === member.grade ? null : next);
          }}
          className="rounded-full bg-bg-subtle px-3 py-1.5 text-[14px] text-text ring-1 ring-line"
        >
          {GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {gradeLabel(grade)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void view()}
          className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[14px] font-medium text-text ring-1 ring-line transition hover:bg-line"
        >
          이 계정 보기
        </button>
      </div>

      {asking !== null && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px] text-text">
          <span className="min-w-0 flex-1 break-keep">
            {gradeLabel(member.grade)} → <strong>{gradeLabel(asking)}</strong>으로 바꿀까요?
          </span>
          <button
            type="button"
            disabled={state === "saving"}
            onClick={() => void change(asking)}
            className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent disabled:opacity-60"
          >
            {state === "saving" ? "바꾸는 중…" : "바꾸기"}
          </button>
          <button type="button" onClick={() => setAsking(null)} className="text-[13px] font-medium text-text-muted">
            취소
          </button>
        </div>
      )}
      {state === "failed" && <p className="text-[12px] text-[#d70015]">등급을 바꾸지 못했어요.</p>}
      {state === "viewFailed" && <p className="text-[12px] text-[#d70015]">기록을 남기지 못해 열지 않았어요. 잠시 뒤 다시 해 주세요.</p>}
    </li>
  );
}

export function AdminMembers() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MemberSort>("recent");
  const [members, setMembers] = useState<AdminMember[] | null>(null);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const turn = useRef(0);

  const load = async (offset: number) => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const mine = ++turn.current;
    const result = await fetchMembers(supabase, query, sort, offset);
    // 그 사이 검색어나 정렬이 바뀌었으면 늦게 온 답은 버린다.
    if (mine !== turn.current) return;
    if (result === "failed") {
      setFailed(true);
      return;
    }
    setFailed(false);
    setMembers((now) => (offset === 0 ? result.members : [...(now ?? []), ...result.members]));
    setMore(result.more);
  };

  useEffect(() => {
    // 검색어는 치는 동안 잠깐 기다렸다 묻는다.
    const id = setTimeout(() => void load(0), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이메일로 찾기"
          aria-label="이메일로 찾기"
          className="min-w-0 flex-1 rounded-full bg-surface px-4 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
        />
        <select
          aria-label="정렬"
          value={sort}
          onChange={(event) => setSort(event.target.value as MemberSort)}
          className="rounded-full bg-surface px-3 py-2.5 text-[14px] text-text ring-1 ring-line"
        >
          <option value="recent">최근 가입 순</option>
          <option value="photos">사진 많은 순</option>
        </select>
      </div>

      {failed && (
        <p role="alert" className="rounded-2xl bg-surface p-4 text-[14px] text-text-muted ring-1 ring-line">
          회원 목록을 읽지 못했어요. supabase/admin.sql 을 실행했는지 확인해 주세요.
        </p>
      )}
      {members === null && !failed && <p className="text-[14px] text-text-muted">불러오는 중…</p>}
      {members && members.length === 0 && <p className="text-[14px] text-text-muted">찾는 회원이 없어요.</p>}

      {members && members.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {members.map((member) => (
            <MemberRow key={member.id} member={member} onChanged={() => void load(0)} />
          ))}
        </ul>
      )}
      {more && (
        <button
          type="button"
          onClick={() => void load(members?.length ?? 0)}
          className="self-center rounded-full bg-surface px-5 py-2 text-[14px] font-medium text-text ring-1 ring-line"
        >
          더 보기
        </button>
      )}
    </section>
  );
}
