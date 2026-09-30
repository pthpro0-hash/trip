"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  RESHRUNK_BYTES,
  scanStorage,
  sweepOrphans,
  worthReshrinking,
  type StorageReport,
} from "@/lib/supabase/storageSweep";
import { reshrinkPhotos, type ReshrinkOutcome } from "@/lib/supabase/photos";
import { WaitingOverlay } from "@/components/layout/Waiting";

/*
  사진 보관함 정리.

  내 보관함이 무엇으로 차 있는지 보여 주고, 아무도 쓰지 않는 파일
  (지운 여행의 사진, 낡은 판 등)이 있으면 지울 수 있게 한다. 지우는 것은
  되돌릴 수 없으니 살펴본 뒤 한 번 더 누르게 한다.

  도움말의 "내 데이터"에 둔다. 자주 쓸 일이 아니다. 예전에는 여행 목록 맨 아래였다.
*/

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`;

type Phase =
  | { kind: "idle" }
  | { kind: "working"; title: string; detail?: string }
  | { kind: "done"; removed: number }
  | { kind: "reshrunk"; outcome: ReshrinkOutcome };

const count = (value: number) => value.toLocaleString("ko-KR");

/** 다시 줄이기를 마친 뒤 한 줄. 줄인 것, 줄일 수 없어 둔 것, 못 한 것을 차례로. */
export function reshrunkMessage(outcome: ReshrinkOutcome): string {
  const parts: string[] = [];
  if (outcome.done > 0) {
    parts.push(
      `사진 ${count(outcome.done)}장을 다시 줄였어요(${mb(outcome.bytesBefore)} → ${mb(outcome.bytesAfter)}).`,
    );
  }
  if (outcome.skipped > 0) parts.push(`${count(outcome.skipped)}장은 더 줄일 수 없어 그대로 뒀어요.`);
  if (outcome.failed > 0) {
    parts.push(`${count(outcome.failed)}장은 못 했어요 — 보관함 살펴보기를 다시 누르면 남은 것만 이어서 할 수 있어요.`);
  }
  return parts.length > 0 ? parts.join(" ") : "다시 줄인 사진이 없어요.";
}

export function StorageTidy() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [failed, setFailed] = useState<string | null>(null);

  const scan = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      // 도움말은 로그인하지 않은 사람도 연다. 눌러서 아무 일도 없으면 고장난 단추로 보인다.
      setFailed("로그인해야 보관함을 살펴볼 수 있어요.");
      return;
    }
    setFailed(null);
    setPhase({ kind: "working", title: "보관함을 살펴보고 있어요" });
    const found = await scanStorage(supabase, data.user.id, (done, total) =>
      setPhase({ kind: "working", title: "보관함을 살펴보고 있어요", detail: `폴더 ${done} / ${total}` }),
    );
    setPhase({ kind: "idle" });
    if (!found) {
      setFailed("보관함을 살펴보지 못했어요. 잠시 후 다시 해 주세요.");
      return;
    }
    setReport(found);
  };

  const sweep = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !report) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    setPhase({ kind: "working", title: "쓰지 않는 파일을 지우고 있어요" });
    const removed = await sweepOrphans(supabase, data.user.id, report.orphans, (done, total) =>
      setPhase({ kind: "working", title: "쓰지 않는 파일을 지우고 있어요", detail: `${done} / ${total}` }),
    );
    setPhase({ kind: "done", removed });
    setReport(null);
  };

  const reshrinkAll = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !report) return;
    const title = "사진을 다시 줄이고 있어요";
    setPhase({ kind: "working", title, detail: "화면을 끄거나 닫지 마세요" });
    /*
      폰은 한동안 손대지 않으면 화면이 꺼지고, 꺼지면 이 일도 멈춘다.
      359장 가운데 101장만 하고 멈춘 적이 있다. 하는 동안 화면을 켜 둔다.
      못 켜 두는 브라우저면 그냥 한다.
    */
    const awake = await navigator.wakeLock?.request("screen").catch(() => null);
    try {
      const outcome = await reshrinkPhotos(supabase, report.heavy, (done, total) =>
        setPhase({ kind: "working", title, detail: `${done} / ${total} · 화면을 끄거나 닫지 마세요` }),
      );
      setPhase({ kind: "reshrunk", outcome });
    } finally {
      await awake?.release().catch(() => undefined);
    }
    setReport(null);
  };

  const used = report ? report.used.full.bytes + report.used.thumb.bytes + report.used.marker.bytes : 0;

  return (
    <section className="mt-6 flex flex-col gap-3 rounded-2xl bg-bg-subtle p-5">
      {phase.kind === "working" && <WaitingOverlay title={phase.title} detail={phase.detail} />}

      <div>
        <h2 className="text-[15px] font-semibold text-text">사진 보관함 정리</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
          사진 한 장은 크기별로 파일 셋(보관본·목록용·지도 핀용)으로 보관돼요. 지운 여행의 사진처럼 아무도
          쓰지 않는 파일이 남아 있으면 찾아서 지울 수 있어요.
        </p>
      </div>

      {!report && (
        <button
          type="button"
          onClick={() => void scan()}
          className="self-start rounded-full bg-surface px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line transition hover:bg-line"
        >
          보관함 살펴보기
        </button>
      )}

      {phase.kind === "done" && (
        <p className="text-[14px] font-medium text-accent">
          {phase.removed > 0 ? `쓰지 않는 파일 ${phase.removed}개를 지웠어요.` : "지울 파일이 없었어요."}
        </p>
      )}
      {phase.kind === "reshrunk" && (
        <p className="text-[14px] font-medium text-accent">{reshrunkMessage(phase.outcome)}</p>
      )}
      {failed && <p className="text-[14px] text-text-muted">{failed}</p>}

      {report && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1 text-[14px] text-text">
            <li>
              사진 {report.photoCount.toLocaleString("ko-KR")}장이 <strong>{mb(used)}</strong>를 쓰고 있어요
            </li>
            <li className="text-[13px] text-text-muted">
              보관본 {mb(report.used.full.bytes)} · 목록용 {mb(report.used.thumb.bytes)} · 지도 핀용{" "}
              {mb(report.used.marker.bytes)}
            </li>
          </ul>
          {worthReshrinking(report) && (
            <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ring-line">
              <p className="text-[14px] text-text">
                무겁게 보관된 사진 <strong>{report.heavy.length.toLocaleString("ko-KR")}장</strong>(
                {mb(report.heavyBytes)})이 있어요. 덜 줄여진 채로 보관된 것이에요. 다시 줄이면 약{" "}
                {mb(report.heavy.length * RESHRUNK_BYTES)}로 가벼워지고, 사진과 기록은 그대로예요.
              </p>
              <p className="text-[13px] leading-relaxed text-text-muted">
                한 장씩 내려받아 다시 줄이므로 약 {mb(report.heavyBytes)}를 내려받아요. 컴퓨터의 크롬에서 와이파이로
                하는 것이 빠르고 가장 가볍게 줄여져요. 중간에 멈춰도 다시 살펴보면 남은 것만 이어서 할 수 있어요.
              </p>
              <button
                type="button"
                onClick={() => void reshrinkAll()}
                className="self-start rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
              >
                {report.heavy.length.toLocaleString("ko-KR")}장 다시 줄이기
              </button>
            </div>
          )}
          {report.orphans.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl bg-surface p-4 ring-1 ring-line">
              <p className="text-[14px] text-text">
                아무도 쓰지 않는 파일 <strong>{report.orphans.length.toLocaleString("ko-KR")}개</strong>(
                {mb(report.orphanBytes)})가 있어요. 지운 여행의 사진이나 예전 방식의 작은 판이에요. 지워도 지금
                보이는 기록과 사진은 그대로예요.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void sweep()}
                  className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
                >
                  {report.orphans.length.toLocaleString("ko-KR")}개 지우기
                </button>
                <button
                  type="button"
                  onClick={() => setReport(null)}
                  className="rounded-full px-4 py-2 text-[14px] font-medium text-text-muted hover:text-text"
                >
                  그대로 두기
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] font-medium text-accent">쓰지 않는 파일이 없어요. 깨끗해요.</p>
          )}
        </div>
      )}
    </section>
  );
}
