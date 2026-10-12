"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  fetchAllSuggestions,
  isAdmin,
  setSuggestionStatus,
  STATUS_LABEL,
  type Suggestion,
  type SuggestionStatus,
} from "@/lib/supabase/spotSuggestions";

/*
  관리자 화면 — 이용자가 보낸 빠진 곳 추천을 보고 반영 여부를 정한다. 목록에 넣는 일은 개발로 하고, 여기서는 결정과 메모만 남긴다
  (메모는 보낸 사람에게도 보인다). 관리자가 아니면 아무것도 읽지 못한다(표의 정책이 막고, 이 화면도 먼저 확인한다).
*/
const STATUSES: SuggestionStatus[] = ["new", "planned", "duplicate", "declined"];

function Row({ item, onSaved }: { item: Suggestion; onSaved: () => void }) {
  const [status, setStatus] = useState<SuggestionStatus>(item.status);
  const [note, setNote] = useState(item.adminNote ?? "");
  const [state, setState] = useState<"idle" | "saving" | "done" | "failed">("idle");
  const changed = status !== item.status || note.trim() !== (item.adminNote ?? "");

  const save = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setState("saving");
    const ok = await setSuggestionStatus(supabase, item.id, status, note);
    setState(ok ? "done" : "failed");
    if (ok) onSaved();
  };

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-bg-subtle p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[16px] font-semibold text-text">{item.name}</p>
        <p className="shrink-0 text-[12px] text-text-faint">{item.createdAt.slice(0, 10)}</p>
      </div>
      {item.place && <p className="text-[13px] text-text-muted">{item.place}</p>}
      {item.reason && <p className="break-keep text-[14px] text-text">{item.reason}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={`${item.name} 상태`}
          value={status}
          onChange={(event) => setStatus(event.target.value as SuggestionStatus)}
          className="rounded-lg bg-surface px-2.5 py-1.5 text-[14px] text-text ring-1 ring-line"
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </select>
        <input
          aria-label={`${item.name} 메모`}
          value={note}
          maxLength={300}
          placeholder="메모(보낸 분께도 보여요)"
          onChange={(event) => setNote(event.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-surface px-2.5 py-1.5 text-[14px] text-text ring-1 ring-line"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={!changed || state === "saving"}
          className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-semibold text-on-accent disabled:opacity-50"
        >
          {state === "saving" ? "저장 중…" : "저장"}
        </button>
      </div>
      {state === "done" && !changed && <p className="text-[12px] text-text-faint">저장했어요.</p>}
      {state === "failed" && <p className="text-[12px] text-red-600">저장하지 못했어요.</p>}
    </li>
  );
}

export function AdminSuggestions() {
  const [phase, setPhase] = useState<"loading" | "denied" | "ready" | "failed">("loading");
  const [list, setList] = useState<Suggestion[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = getBrowserClient();
      if (!supabase) return alive && setPhase("denied");
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user || !(await isAdmin(supabase, data.user.id))) return alive && setPhase("denied");
        const all = await fetchAllSuggestions(supabase);
        if (!alive) return;
        if (!all) return setPhase("failed");
        setList(all);
        setPhase("ready");
      } catch {
        if (alive) setPhase("failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, [version]);

  if (phase === "loading") return <p className="text-[14px] text-text-muted">불러오는 중이에요…</p>;
  if (phase === "denied") return <p className="text-[14px] text-text-muted">이 화면을 볼 권한이 없어요.</p>;
  if (phase === "failed") return <p className="text-[14px] text-text-muted">추천 목록을 읽지 못했어요. 새로 고쳐 보세요.</p>;

  const waiting = list.filter((item) => item.status === "new").length;
  return (
    <section className="flex flex-col gap-3">
      <p className="text-[14px] text-text-muted">
        전체 {list.length}건 · 검토 전 {waiting}건
      </p>
      {list.length === 0 ? (
        <p className="text-[14px] text-text-muted">아직 받은 추천이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((item) => (
            <Row key={`${item.id}:${item.status}:${item.adminNote ?? ""}`} item={item} onSaved={() => setVersion((n) => n + 1)} />
          ))}
        </ul>
      )}
    </section>
  );
}
