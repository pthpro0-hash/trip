"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  cancelGradeRequest,
  fetchMyRequest,
  fetchQuota,
  requestGrade,
  type GradeRequest,
  type RequestResult,
} from "@/lib/supabase/grade";
import {
  REQUEST_MESSAGE_MAX,
  limitLabel,
  limitOf,
  nearlyFull,
  roomLeft,
  upgradesFrom,
  usedRatio,
  type Grade,
  type Quota,
} from "@/lib/grade";

/*
  내 정보의 "사진 보관" 칸 — 보관 한도와 사용량, 그리고 등업 신청.

  등급 번호는 보이지 않는다. 이용자에게 뜻이 있는 것은 "몇 장까지 보관하나"뿐이다(lib/grade). 등업 신청은 지금보다 큰 한도를
  고르고, 하고 싶은 말을 남기면 관리자가 /admin 에서 결정한다. 검토 전 신청은 하나뿐이고 거둘 수 있다.

  한도를 못 읽으면(admin.sql 실행 전 등) 칸을 그리지 않는다.
*/

const WHY: Record<Exclude<RequestResult, "ok">, string> = {
  login: "로그인이 풀렸어요. 다시 로그인해 주세요.",
  invalid: "지금보다 큰 한도만 신청할 수 있어요.",
  pending: "검토 중인 신청이 이미 있어요.",
  failed: "신청하지 못했어요. 잠시 뒤 다시 해 주세요.",
};

const day = (iso: string) => iso.slice(0, 10).replaceAll("-", ".");

export function PhotoQuotaView({
  quota,
  request,
  busy,
  message,
  onRequest,
  onCancel,
}: {
  quota: Quota;
  request: GradeRequest | null;
  busy: boolean;
  message: string | null;
  onRequest: (to: Grade, text: string) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const choices = upgradesFrom(quota.grade);
  const [to, setTo] = useState<Grade | null>(choices.at(-1) ?? null);
  const [text, setText] = useState("");
  const left = roomLeft(quota);
  const pending = request?.status === "pending" ? request : null;
  const ratio = usedRatio(quota);

  return (
    <section aria-labelledby="quota-title" className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quota-title" className="text-[16px] font-semibold text-text">
          사진 보관
        </h2>
        <p className="text-[13px] text-text-muted">보관 한도 {limitLabel(quota.limit)}</p>
      </div>

      {quota.limit === null ? (
        <p className="text-[15px] text-text">
          {quota.used.toLocaleString("ko-KR")}장 보관 중 <span className="text-text-muted">· 한도 없이 올릴 수 있어요</span>
        </p>
      ) : (
        <>
          <p className="text-[15px] text-text">
            <strong className="font-semibold">{quota.used.toLocaleString("ko-KR")}</strong> / {limitLabel(quota.limit)} 사용
            <span className="text-text-muted"> · 남은 자리 {(left ?? 0).toLocaleString("ko-KR")}장</span>
          </p>
          <div
            role="progressbar"
            aria-label="사진 보관 사용량"
            aria-valuemin={0}
            aria-valuemax={quota.limit}
            aria-valuenow={Math.min(quota.used, quota.limit)}
            className="h-2 overflow-hidden rounded-full bg-bg-subtle"
          >
            <div
              className={`h-full rounded-full ${ratio >= 1 ? "bg-[#d70015]" : nearlyFull(quota) ? "bg-[#f59e0b]" : "bg-accent"}`}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
          </div>
          {nearlyFull(quota) && (
            <p className="break-keep text-[13px] text-text-muted">
              {ratio >= 1 ? "보관 자리가 다 찼어요. 사진 없이 기록은 계속 남길 수 있어요." : "보관 자리가 얼마 남지 않았어요."}
            </p>
          )}
        </>
      )}

      {pending ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[14px] text-text">
          <span className="break-keep">
            {limitLabel(limitOf(pending.toGrade))}으로 등업 신청을 검토하고 있어요 · {day(pending.createdAt)}
          </span>
          <button type="button" onClick={onCancel} disabled={busy} className="text-[13px] font-medium text-text-muted underline underline-offset-2 disabled:opacity-60">
            신청 거두기
          </button>
        </div>
      ) : (
        request &&
        request.status !== "pending" && (
          <p className="break-keep text-[13px] text-text-muted">
            지난 등업 신청({limitLabel(limitOf(request.toGrade))}):{" "}
            {request.status === "approved" ? "반영됐어요" : "이번엔 어려워요"}
            {request.adminNote ? ` — ${request.adminNote}` : ""}
          </p>
        )
      )}

      {!pending && choices.length > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-full bg-bg-subtle px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line transition hover:bg-line"
        >
          등업 신청
        </button>
      )}

      {!pending && open && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (to !== null) onRequest(to, text);
          }}
        >
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-[13px] font-medium text-text-muted">바라는 보관 한도</legend>
            <div className="flex flex-wrap gap-2">
              {choices.map((grade) => (
                <label
                  key={grade}
                  className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[14px] font-medium ring-1 transition ${
                    to === grade ? "bg-accent text-on-accent ring-accent" : "bg-bg-subtle text-text ring-line"
                  }`}
                >
                  <input type="radio" name="grade" className="sr-only" checked={to === grade} onChange={() => setTo(grade)} />
                  {limitLabel(limitOf(grade))}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-muted">하고 싶은 말 (선택)</span>
            <textarea
              value={text}
              maxLength={REQUEST_MESSAGE_MAX}
              rows={3}
              placeholder="예: 해외여행 사진을 함께 보관하고 싶어요"
              onChange={(event) => setText(event.target.value)}
              className="resize-y rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || to === null}
              className="rounded-full bg-accent px-5 py-2.5 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
            >
              {busy ? "보내는 중…" : "신청하기"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[14px] font-medium text-text-muted">
              취소
            </button>
          </div>
        </form>
      )}

      {message && (
        <p role="status" className="break-keep text-[13px] text-text-muted">
          {message}
        </p>
      )}
    </section>
  );
}

/** 알아서 읽고 쓰는 칸. 로그인한 사람의 내 정보에만 둔다. */
export function PhotoQuota({ userId }: { userId: string }) {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [request, setRequest] = useState<GradeRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const [found, mine] = await Promise.all([fetchQuota(supabase), fetchMyRequest(supabase, userId)]);
    setQuota(found);
    if (mine !== "failed") setRequest(mine);
  };

  useEffect(() => {
    // 처음 한 번 읽는다.
    void Promise.resolve().then(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!quota) return null;

  const send = async (to: Grade, text: string) => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const result = await requestGrade(supabase, to, text);
    setBusy(false);
    setMessage(result === "ok" ? "등업 신청을 보냈어요. 검토가 끝나면 여기에서 알려 드려요." : WHY[result]);
    await reload();
  };

  const cancel = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const ok = await cancelGradeRequest(supabase);
    setBusy(false);
    setMessage(ok ? "신청을 거뒀어요." : "거두지 못했어요. 잠시 뒤 다시 해 주세요.");
    await reload();
  };

  return (
    <PhotoQuotaView
      quota={quota}
      request={request}
      busy={busy}
      message={message}
      onRequest={(to, text) => void send(to, text)}
      onCancel={() => void cancel()}
    />
  );
}
