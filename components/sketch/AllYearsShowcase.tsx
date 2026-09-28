"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { SketchTrip } from "@/lib/sketch";
import type { SidoOf } from "@/lib/sketchStory";
import { headline } from "@/lib/sketchWords";
import { yearsStory } from "@/lib/yearsStory";
import { allShareSource } from "@/lib/share";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { WaitingOverlay } from "@/components/layout/Waiting";
import { YearsCard } from "./YearsCard";
import { YearsScenes } from "./YearsScenes";

/* 링크 창은 누를 때만 받는다(SketchShowcase 와 같은 까닭). */
const ShareDialog = dynamic(() => import("@/components/share/ShareDialog").then((module) => module.ShareDialog), {
  ssr: false,
});

/*
  지금까지 전부.

  한 해 화면이 "그해 어땠나"라면 이것은 "해마다 어떻게 달라졌나"다.
  카드는 해마다 색을 달리해 한 장에 겹치고, 그 아래에서 해끼리 견준다 —
  가장 많이 떠난 해, 사진을 가장 많이 남긴 해, 처음 밟은 곳이 가장 많던 해.
  해 줄을 누르면 그해 한 장으로 넘어간다.
*/

interface AllYearsShowcaseProps {
  all: SketchTrip[];
  sidoOf: SidoOf | undefined;
  onPickYear: (year: number) => void;
  /** 로그인한 사람. 있어야 링크로 보여 줄 수 있다. */
  userId?: string | null;
}

export function AllYearsShowcase({ all, sidoOf, onPickYear, userId = null }: AllYearsShowcaseProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"card" | "story" | null>(null);
  const [failed, setFailed] = useState(false);

  const story = useMemo(() => yearsStory(all, sidoOf), [all, sidoOf]);
  const line = useMemo(() => headline(story.total, "all"), [story]);
  /* 링크로 보여 줄 한 줄 — 사람 이름은 뺀다(SketchShowcase 와 같은 까닭). */
  const sharedLine = useMemo(() => headline(story.total, "all", { people: false }), [story]);
  const shareSource = useMemo(() => allShareSource({ headline: sharedLine, story }), [sharedLine, story]);
  const [sharing, setSharing] = useState(false);
  const closeShare = useCallback(() => setSharing(false), []);

  const save = async (kind: "card" | "story") => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    setSaving(kind);
    setFailed(false);
    const name = kind === "story" ? "여행스케치-지금까지-세로.png" : "여행스케치-지금까지.png";
    if (!(await downloadSvgAsPng(svg, name, { story: kind === "story" }))) setFailed(true);
    setSaving(null);
  };

  return (
    <article className="flex flex-col gap-5">
      {saving && <WaitingOverlay title="그림을 만들고 있어요" note="다 되면 저절로 받아져요." />}

      <header className="flex flex-col gap-1">
        <p className="text-[24px] font-bold leading-snug tracking-tight text-text md:text-[28px]">{line}</p>
        <p className="text-[15px] text-text-muted">{story.spanLine}</p>
      </header>

      <div ref={holder} className="overflow-hidden rounded-2xl ring-1 ring-line">
        <YearsCard stats={story.total} headline={line} layers={story.layers} rows={story.rows} />
      </div>

      <YearsScenes story={story} onPickYear={onPickYear} />

      <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-col gap-1.5 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        {failed && <p className="text-[13px] text-text-muted">저장하지 못했어요.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save("card")}
            disabled={saving !== null}
            aria-label="지금까지 이미지 저장"
            className="flex-1 rounded-full bg-accent px-1.5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            이미지 저장
          </button>
          <button
            type="button"
            onClick={() => void save("story")}
            disabled={saving !== null}
            className="flex-1 rounded-full bg-bg-subtle px-1.5 py-2.5 text-[14px] font-medium text-text transition hover:bg-line disabled:opacity-60"
          >
            스토리용 세로
          </button>
          {userId && (
            <button
              type="button"
              onClick={() => setSharing(true)}
              disabled={saving !== null}
              aria-label="지금까지 링크로 보여 주기"
              className="flex-1 rounded-full bg-bg-subtle px-1.5 py-2.5 text-[14px] font-medium text-accent transition hover:bg-line disabled:opacity-60"
            >
              링크 공유
            </button>
          )}
        </div>
      </div>

      {sharing && userId && (
        <ShareDialog
          userId={userId}
          source={shareSource}
          headline={sharedLine}
          localPhotos={new Map()}
          onClose={closeShare}
        />
      )}
    </article>
  );
}
