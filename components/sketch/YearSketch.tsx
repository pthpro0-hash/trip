"use client";

import { useMemo, useRef, useState } from "react";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { headline } from "@/lib/sketchWords";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { SketchCard } from "./SketchCard";

/*
  한 해를 한 장으로.

  저장 단추를 카드마다 둔다. 공유하는 것은 "내 평생"이 아니라 "2026년의
  나"이고, 한 장씩 따로 나와야 그게 된다.
*/

interface YearSketchProps {
  year: number;
  trips: SketchTrip[];
  /** 사람으로 걸러 보고 있으면 제목에 함께 적는다. */
  person: string | null;
}

export function YearSketch({ year, trips, person }: YearSketchProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"card" | "story" | null>(null);
  const [failed, setFailed] = useState(false);

  const sketch = useMemo(() => buildSketch(trips), [trips]);
  const shapes = useMemo(() => sketchShapes(trips), [trips]);
  const line = useMemo(() => headline(sketch, "year"), [sketch]);
  const months = useMemo(() => monthStrip(trips), [trips]);

  const title = person ? `${year}년 · ${person}와` : `${year}년`;

  const save = async (kind: "card" | "story") => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    setSaving(kind);
    setFailed(false);
    const name = kind === "story" ? `여행스케치-${title}-세로.png` : `여행스케치-${title}.png`;
    const ok = await downloadSvgAsPng(svg, name, { story: kind === "story" });
    if (!ok) setFailed(true);
    setSaving(null);
  };

  return (
    <section className="flex flex-col gap-3">
      <div ref={holder} className="overflow-hidden rounded-2xl ring-1 ring-line">
        <SketchCard
          sketch={sketch}
          shapes={shapes}
          title={title}
          headline={line}
          months={months}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save("card")}
          disabled={saving !== null}
          className="rounded-full bg-bg-subtle px-4 py-2 text-[13px] font-medium text-text transition hover:bg-line disabled:opacity-60"
        >
          {saving === "card" ? "만드는 중…" : `${year}년 저장하기`}
        </button>
        {/* 공유는 대부분 세로다. */}
        <button
          type="button"
          onClick={() => void save("story")}
          disabled={saving !== null}
          className="rounded-full bg-bg-subtle px-4 py-2 text-[13px] font-medium text-text transition hover:bg-line disabled:opacity-60"
        >
          {saving === "story" ? "만드는 중…" : "스토리용 세로로"}
        </button>
        {failed && <span className="text-[13px] text-text-muted">저장하지 못했어요.</span>}
        {/*
          동행자는 사진에서 알 수 없는 유일한 값이라 대개 비어 있다. 그런데
          "누구와"는 기억을 부르는 힘이 둘째다. 빈 칸을 탓하는 대신,
          채우면 무엇이 생기는지 보여준다.
        */}
        {sketch.withoutCompanion > 0 && !person && (
          <span className="text-[13px] text-text-faint">
            {sketch.withoutCompanion}건은 누구와 갔는지 비어 있어요
          </span>
        )}
      </div>
    </section>
  );
}
