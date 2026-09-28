"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { scanStorage, sweepOrphans, type StorageReport } from "@/lib/supabase/storageSweep";
import { WaitingOverlay } from "@/components/layout/Waiting";

/*
  사진 보관함 정리.

  내 보관함이 무엇으로 차 있는지 보여 주고, 아무도 쓰지 않는 파일
  (지운 여행의 사진, 낡은 판 등)이 있으면 지울 수 있게 한다. 지우는 것은
  되돌릴 수 없으니 살펴본 뒤 한 번 더 누르게 한다.

  목록 맨 아래 조용히 둔다. 자주 쓸 일이 아니다.
*/

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`;

type Phase = { kind: "idle" } | { kind: "working"; title: string; detail?: string } | { kind: "done"; removed: number };

export function StorageTidy() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [failed, setFailed] = useState<string | null>(null);

  const scan = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
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
