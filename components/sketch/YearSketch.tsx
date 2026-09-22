"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { headline } from "@/lib/sketchWords";
import type { Region } from "@/lib/types";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { getBrowserClient } from "@/lib/supabase/client";
import { thumbUrls } from "@/lib/supabase/photos";
import { inlinePhotos } from "@/lib/photo/inlinePhoto";
import { SketchCard } from "./SketchCard";

/*
  사진을 받아 둘 자리 수.

  이 중에서 카드가 서로 겹치지 않는 것만 골라 얹는다. 겹쳐서 버려지는
  것이 있으므로 얹을 수보다 넉넉히 받아 둔다.
*/
const PHOTOS_ON_MAP = 10;

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
  /** 고른 권역. 지도를 그쪽으로 당기고 제목에도 적는다. */
  region: Region | null;
  /** 이 해에 적어 둔 한 줄. 없으면 화면이 지어 낸다. */
  written: string | undefined;
  /** 고쳐 적기. 걸러 보는 중에는 넘어오지 않는다. */
  onWrite?: (year: number, line: string) => Promise<boolean>;
}

export function YearSketch({ year, trips, person, region, written, onWrite }: YearSketchProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"card" | "story" | null>(null);
  const [failed, setFailed] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  /** Escape 로 버리는 중이면 손을 뗄 때 저장하지 않는다. */
  const cancelling = useRef(false);

  const sketch = useMemo(() => buildSketch(trips), [trips]);
  const shapes = useMemo(() => sketchShapes(trips), [trips]);
  const made = useMemo(() => headline(sketch, "year"), [sketch]);
  /*
    걸러 보는 중에는 지어 낸 말을 쓴다. 적어 둔 한 줄은 "2026년"의
    것이지 "2026년 · 강원권"의 것이 아니다.
  */
  const line = onWrite && written !== undefined ? written : made;
  const months = useMemo(() => monthStrip(trips), [trips]);

  /*
    사진을 얹을 자리.

    스무 자리에 스무 장을 다 얹으면 난장판이 된다. 사진을 가장 많이 찍은
    몇 곳만 고른다 — 오래 머문 곳이 그해를 가장 잘 말해 준다.
  */
  const featured = useMemo(
    () =>
      shapes.dots
        .filter((dot) => dot.photoPath)
        .sort((a, b) => b.photoCount - a.photoCount)
        .slice(0, PHOTOS_ON_MAP)
        .map((dot) => dot.photoPath!),
    [shapes],
  );

  const [photos, setPhotos] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase || featured.length === 0) return;
    let active = true;

    void (async () => {
      try {
        const urls = await thumbUrls(supabase, featured);
        const inlined = await inlinePhotos(urls);
        if (active) setPhotos(inlined);
      } catch {
        // 사진을 못 얹어도 지도는 점으로 그려진다.
      }
    })();

    return () => {
      active = false;
    };
  }, [featured]);

  const title = [`${year}년`, region ?? "", person ? `${person}와` : ""]
    .filter(Boolean)
    .join(" · ");

  const write = async (next: string) => {
    if (!onWrite || next.trim() === (written ?? "")) return;
    setWriteFailed(!(await onWrite(year, next)));
  };

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
          region={region}
          photos={photos}
        />
      </div>

      {/*
        자동은 제안, 확정은 사람. 걸러 보는 중에는 내밀지 않는다 —
        그때 적히는 말은 그 해가 아니라 걸러낸 것을 가리킨다.
      */}
      {onWrite && (
        <label className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-text-faint">{year}년을 한 줄로</span>
          <input
            type="text"
            defaultValue={written ?? ""}
            key={written ?? ""}
            placeholder={made}
            aria-label={`${year}년 한 줄`}
            onBlur={(event) => {
              if (cancelling.current) {
                cancelling.current = false;
                return;
              }
              void write(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                cancelling.current = true;
                event.currentTarget.value = written ?? "";
                event.currentTarget.blur();
              }
            }}
            className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line placeholder:text-text-faint focus:ring-2 focus:ring-accent"
          />
          {writeFailed && (
            <span className="text-[13px] text-text-muted">적어두지 못했어요.</span>
          )}
        </label>
      )}

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
