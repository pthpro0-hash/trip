"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { decideGradeRequest, type AdminRequest } from "@/lib/supabase/grade";
import { REQUEST_MESSAGE_MAX, gradeLabel, limitLabel, limitOf } from "@/lib/grade";

/*
  관리자 — 등업 신청. 검토 전 신청을 위에, 최근에 결정한 것을 아래에 둔다. 승인하면 신청한 등급으로 바뀌고, 거절이든 승인이든
  남긴 메모는 신청한 사람의 내 정보에 보인다.
*/

const day = (iso: string | null) => (iso ? iso.slice(0, 10).replaceAll("-", ".") : "—");

function Pending({ item, onDone }: { item: AdminRequest; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "failed">("idle");

  const decide = async (approve: boolean) => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setState("saving");
    const ok = await decideGradeRequest(supabase, item.id, approve, note);
    setState(ok ? "idle" : "failed");
    if (ok) onDone();
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 break-all text-[15px] font-semibold text-text">{item.email ?? "(이메일 없음)"}</p>
        <p className="shrink-0 text-[12px] text-text-faint">{day(item.createdAt)}</p>
      </div>
      <p className="text-[14px] text-text">
        {gradeLabel(item.gradeNow)} → <strong>{gradeLabel(item.toGrade)}</strong>
        <span className="text-text-muted"> · 지금 사진 {item.photoCount.toLocaleString("ko-KR")}장</span>
      </p>
      {item.message && <p className="break-keep rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[14px] text-text">{item.message}</p>}
      <input
        value={note}
        maxLength={REQUEST_MESSAGE_MAX}
        onChange={(event) => setNote(event.target.value)}
        placeholder="메모(신청한 분께도 보여요, 선택)"
        aria-label="메모"
        className="rounded-xl bg-bg-subtle px-3.5 py-2 text-[14px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={state === "saving"}
          onClick={() => void decide(true)}
          className="rounded-full bg-accent px-4 py-1.5 text-[14px] font-semibold text-on-accent disabled:opacity-60"
        >
          승인 ({limitLabel(limitOf(item.toGrade))})
        </button>
        <button
          type="button"
          disabled={state === "saving"}
          onClick={() => void decide(false)}
          className="rounded-full bg-bg-subtle px-4 py-1.5 text-[14px] font-medium text-text ring-1 ring-line disabled:opacity-60"
        >
          거절
        </button>
      </div>
      {state === "failed" && <p className="text-[12px] text-[#d70015]">결정하지 못했어요. 이미 결정된 신청일 수 있어요.</p>}
    </li>
  );
}

export function AdminRequests({ items, onChanged }: { items: AdminRequest[]; onChanged: () => void }) {
  const pending = items.filter((item) => item.status === "pending");
  const decided = items.filter((item) => item.status !== "pending");

  return (
    <section className="flex flex-col gap-5">
      {pending.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-[14px] text-text-muted ring-1 ring-line">검토할 등업 신청이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {pending.map((item) => (
            <Pending key={item.id} item={item} onDone={onChanged} />
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="px-1 text-[13px] font-semibold text-text-faint">최근에 결정한 신청</h2>
          <ul className="flex flex-col gap-1.5">
            {decided.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1 text-[13px] text-text-muted">
                <span className="break-all font-medium text-text">{item.email ?? "(이메일 없음)"}</span>
                <span>
                  {limitLabel(limitOf(item.toGrade))} · {item.status === "approved" ? "승인" : "거절"} · {day(item.decidedAt)}
                </span>
                {item.adminNote && <span className="break-keep">— {item.adminNote}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
