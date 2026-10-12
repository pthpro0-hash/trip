"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchOverseasVisits, refreshAbroadNames, type OverseasVisit } from "@/lib/supabase/abroadNames";

/*
  내 정보 › 내 자료의 한 줄 — 해외에서 다녀온 곳의 이름을 세부 지역명으로 새로 붙인다. 해외 곳이 하나도 없으면 줄을 두지 않는다.
  직접 적은 이름은 바꾸지 않는다(lib/supabase/abroadNames). 곳마다 조회에 1초쯤 걸려 진행을 보여 준다.
*/
export function AbroadNamesRow() {
  const [visits, setVisits] = useState<OverseasVisit[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = getBrowserClient();
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const found = await fetchOverseasVisits(supabase, data.user.id);
        if (alive) setVisits(found);
      } catch {
        // 알아보지 못하면 줄을 두지 않는다.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (visits.length === 0) return null;

  const run = async () => {
    const supabase = getBrowserClient();
    if (!supabase || progress) return;
    setResult(null);
    setProgress({ done: 0, total: visits.length });
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const outcome = await refreshAbroadNames(supabase, data.user.id, visits, (done, total) => setProgress({ done, total }));
      setResult(
        outcome.failed > 0
          ? `${outcome.renamed}곳의 이름을 바꿨어요. ${outcome.failed}곳은 조회하지 못했어요 — 잠시 뒤 다시 해 보세요.`
          : outcome.renamed > 0
            ? `${outcome.renamed}곳의 이름을 세부 지역명으로 바꿨어요.`
            : "바꿀 이름이 없어요. 이미 세부 이름이거나 직접 적으신 이름이에요.",
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-bg-subtle px-4 py-3">
      <button
        type="button"
        onClick={() => void run()}
        disabled={progress !== null}
        className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-[16px] font-semibold text-text">해외 장소 이름 새로 붙이기</span>
          <span className="block break-keep text-[13px] leading-snug text-text-muted">
            {progress ? `${progress.done}곳 / ${progress.total}곳 확인 중이에요…` : `해외에서 다녀온 ${visits.length}곳을 세부 지역명으로 바꿔요`}
          </span>
        </span>
        <span aria-hidden="true" className="text-[16px] text-text-faint">
          ›
        </span>
      </button>
      {result && (
        <p role="status" className="break-keep text-[13px] text-text-muted">
          {result}
        </p>
      )}
    </div>
  );
}
