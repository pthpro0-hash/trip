"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { headline } from "@/lib/sketchWords";
import { tripsOfYear, yearStory, type SidoOf } from "@/lib/sketchStory";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { getBrowserClient } from "@/lib/supabase/client";
import { markerUrls, thumbUrls } from "@/lib/supabase/photos";
import { inlinePhotos } from "@/lib/photo/inlinePhoto";
import { SketchCard } from "./SketchCard";
import { StoryScenes } from "./StoryScenes";
import { WaitingOverlay } from "@/components/layout/Waiting";

/*
  한 해를 한 장으로 — 그리고 그 아래 이야기.

  이 페이지는 남에게 보여 주는 얼굴이다. 찾고 거르는 일은 지도가 맡고,
  여기서는 한 해를 작품으로 보여 준다. 맨 위에 그해의 한 줄을 크게,
  그 아래 카드를, 더 내려가면 그해가 어땠는지를 장면마다 풀어 말한다.

  저장 단추는 늘 화면 아래에 붙어 있다. 어디까지 읽어 내려가든, 마음에
  들면 그 자리에서 바로 저장할 수 있어야 한다.
*/

/*
  지도 위에 얹을 사진을 받아 둘 자리 수. 카드가 겹치지 않는 것만 골라
  얹으므로 얹을 수보다 넉넉히 받는다.
*/
const PHOTOS_ON_MAP = 10;

interface SketchShowcaseProps {
  year: number;
  /** 모든 해의 여행. 작년과 견주는 데도 쓴다. */
  all: SketchTrip[];
  /** 이 해에 적어 둔 한 줄. 없으면 화면이 지어 낸다. */
  written: string | undefined;
  onWrite: (year: number, line: string) => Promise<boolean>;
  /** 시도를 가리는 셈. 불러오기 전에는 없다. */
  sidoOf: SidoOf | undefined;
}

export function SketchShowcase({ year, all, written, onWrite, sidoOf }: SketchShowcaseProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"card" | "story" | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  /** Escape 로 버리는 중이면 손을 뗄 때 저장하지 않는다. */
  const cancelling = useRef(false);

  const trips = useMemo(() => tripsOfYear(all, year), [all, year]);
  const sketch = useMemo(() => buildSketch(trips), [trips]);
  const shapes = useMemo(() => sketchShapes(trips), [trips]);
  const months = useMemo(() => monthStrip(trips), [trips]);
  const story = useMemo(() => yearStory(all, year, sidoOf), [all, year, sidoOf]);
  const made = useMemo(() => headline(sketch, "year"), [sketch]);
  const line = written ?? made;

  /*
    카드 지도에 얹을 사진. 사진을 가장 많이 찍은 몇 곳 — 오래 머문 곳이
    그해를 가장 잘 말해 준다. 카드 속 사진은 손톱만 해서 핀용 작은
    판(160px)으로 충분하다.
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
  const [cardPhotos, setCardPhotos] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase || featured.length === 0) return;
    let active = true;
    void (async () => {
      try {
        const inlined = await inlinePhotos(await markerUrls(supabase, featured));
        if (active) setCardPhotos(inlined);
      } catch {
        // 사진을 못 얹어도 지도는 점으로 그려진다.
      }
    })();
    return () => {
      active = false;
    };
  }, [featured]);

  /* 장면 속 사진은 크게 보이므로 목록 판(960px)을 받는다. */
  const scenePaths = useMemo(
    () => [...new Set([story.topPlace?.photoPath, ...story.photoPaths].filter((p): p is string => !!p))],
    [story],
  );
  const [sceneUrls, setSceneUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase || scenePaths.length === 0) return;
    let active = true;
    void thumbUrls(supabase, scenePaths).then((urls) => {
      if (active) setSceneUrls(urls);
    });
    return () => {
      active = false;
    };
  }, [scenePaths]);

  const title = `${year}년`;

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

  const write = async (next: string) => {
    setEditing(false);
    if (next.trim() === (written ?? "")) return;
    setWriteFailed(!(await onWrite(year, next)));
  };

  return (
    <article className="flex flex-col gap-5">
      {saving && (
        <WaitingOverlay
          title="그림을 만들고 있어요"
          note="사진을 얹은 카드라 조금 걸려요. 다 되면 저절로 받아져요."
        />
      )}

      {/*
        그해의 한 줄을 크게. 화면이 먼저 지어 두지만 그해가 어땠는지는
        본인만 안다 — 고쳐 쓰면 그 말이 카드에도 들어간다.
      */}
      <header className="flex flex-col gap-2">
        {editing ? (
          <input
            type="text"
            autoFocus
            defaultValue={written ?? ""}
            placeholder={made}
            aria-label={`${year}년 한 줄`}
            onBlur={(event) => {
              if (cancelling.current) {
                cancelling.current = false;
                setEditing(false);
                return;
              }
              void write(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                cancelling.current = true;
                event.currentTarget.blur();
              }
            }}
            className="w-full rounded-xl bg-bg-subtle px-3.5 py-3 text-[20px] font-bold tracking-tight text-text outline-none ring-1 ring-line placeholder:font-normal placeholder:text-text-faint focus:ring-2 focus:ring-accent"
          />
        ) : (
          <p className="text-[24px] font-bold leading-snug tracking-tight text-text md:text-[28px]">{line}</p>
        )}
        <div className="flex items-center gap-3 text-[13px]">
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-medium text-accent hover:text-accent-hover"
            >
              ✎ 한 줄 고쳐 쓰기
            </button>
          )}
          {editing && <span className="text-text-faint">비우면 화면이 지은 말로 돌아가요. Esc 로 취소.</span>}
          {writeFailed && <span className="text-text-muted">적어두지 못했어요.</span>}
        </div>
      </header>

      <div ref={holder} className="overflow-hidden rounded-2xl ring-1 ring-line">
        <SketchCard
          sketch={sketch}
          shapes={shapes}
          title={title}
          headline={line}
          months={months}
          region={null}
          photos={cardPhotos}
        />
      </div>

      <StoryScenes story={story} photoUrls={sceneUrls} />

      {/*
        저장은 늘 손 닿는 데. 어디까지 읽어 내려가든 그 자리에서 저장한다.
        공유는 대개 세로라 스토리용을 따로 둔다.
      */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex items-center gap-2 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => void save("card")}
          disabled={saving !== null}
          className="rounded-full bg-accent px-4 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
        >
          {year}년 이미지 저장
        </button>
        <button
          type="button"
          onClick={() => void save("story")}
          disabled={saving !== null}
          className="rounded-full bg-bg-subtle px-4 py-2.5 text-[14px] font-medium text-text transition hover:bg-line disabled:opacity-60"
        >
          스토리용 세로로
        </button>
        {failed && <span className="text-[13px] text-text-muted">저장하지 못했어요.</span>}
      </div>
    </article>
  );
}
