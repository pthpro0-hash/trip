"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/supabase/lazy";
import { isAdmin } from "@/lib/supabase/spotSuggestions";
import { fetchGradeRequests, type AdminRequest } from "@/lib/supabase/grade";
import { AdminMembers } from "./AdminMembers";
import { AdminRequests } from "./AdminRequests";

/*
  관리자 화면 — 회원(등급·계정 보기)과 등업 신청 두 갈래. 관리자(app_admins)가 아니면 아무것도 보이지 않는다(읽는 함수들도
  안에서 관리자인지 확인하고 거절한다, supabase/admin.sql).
*/

type Tab = "members" | "requests";

export function AdminHome() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("members");
  const [requests, setRequests] = useState<AdminRequest[] | "failed" | null>(null);

  const loadRequests = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setRequests(await fetchGradeRequests(supabase));
  };

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) {
      void Promise.resolve().then(() => setAllowed(false));
      return;
    }
    void currentUser(supabase)
      .then(async ({ data }) => {
        const ok = !!data.user && (await isAdmin(supabase, data.user.id));
        setAllowed(ok);
        if (ok) await loadRequests();
      })
      .catch(() => setAllowed(false));
    // 처음 한 번만 확인한다.
  }, []);

  if (allowed === null) return <p className="text-[15px] text-text-muted">확인하는 중…</p>;
  if (!allowed) return <p className="text-[15px] text-text-muted">관리자만 볼 수 있는 화면이에요.</p>;

  const pending = Array.isArray(requests) ? requests.filter((item) => item.status === "pending").length : 0;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="관리" className="flex gap-1.5">
        {(
          [
            ["members", "회원"],
            ["requests", pending > 0 ? `등업 신청 ${pending}` : "등업 신청"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 text-[14px] font-medium transition ${
              tab === id ? "bg-accent text-on-accent" : "bg-surface text-text-muted ring-1 ring-line hover:text-text"
            }`}
          >
            {label}
          </button>
        ))}
        <Link href="/admin/suggestions" className="ml-auto self-center text-[13px] font-medium text-text-muted underline underline-offset-2">
          빠진 곳 추천 관리
        </Link>
      </div>

      {tab === "members" ? (
        <AdminMembers />
      ) : requests === "failed" ? (
        <p role="alert" className="rounded-2xl bg-surface p-4 text-[14px] text-text-muted ring-1 ring-line">
          등업 신청을 읽지 못했어요. supabase/admin.sql 을 실행했는지 확인해 주세요.
        </p>
      ) : requests === null ? (
        <p className="text-[14px] text-text-muted">불러오는 중…</p>
      ) : (
        <AdminRequests items={requests} onChanged={() => void loadRequests()} />
      )}
    </div>
  );
}
