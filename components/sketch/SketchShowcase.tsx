"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { buildSketch, monthStrip, sketchShapes, type SketchTrip } from "@/lib/sketch";
import { headline } from "@/lib/sketchWords";
import { tripsOfYear, yearStory, type SidoOf } from "@/lib/sketchStory";
import { downloadSvgAsPng } from "@/lib/svgToPng";
import { getBrowserClient } from "@/lib/supabase/client";
import { markerUrls, thumbUrls } from "@/lib/supabase/photos";
import { inlinePhoto, inlinePhotos } from "@/lib/photo/inlinePhoto";
import { collagePicks } from "@/lib/collage";
import { yearShareSource } from "@/lib/share";
import {
  CARD_STYLES,
  keepCardStyle,
  readCardStyle,
  styleSuffix,
  subscribeCardStyle,
  type CardStyle,
} from "@/lib/cardStyle";
import { SketchCard } from "./SketchCard";
import { CollageCard } from "./CollageCard";
import { LineCard } from "./LineCard";
import { PAPER } from "./cardInk";
import { StoryScenes } from "./StoryScenes";
import { WaitingOverlay } from "@/components/layout/Waiting";

/*
  링크 창은 누를 때만 받는다. 시도 칠하기 경계(60KB)가 딸려 있어,
  처음부터 받으면 링크를 만들지 않는 사람도 그만큼 기다린다.
*/
const ShareDialog = dynamic(() => import("@/components/share/ShareDialog").then((module) => module.ShareDialog), {
  ssr: false,
});

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

/*
  콜라주 칸에 심을 사진의 긴 변. 큰 칸은 카드 폭을 거의 다 차지해서
  목록 판(960px)을 그대로, 작은 칸은 그보다 작게 — 아홉 장을 다 크게
  심으면 카드 하나가 몇 MB 가 된다.
*/
const COLLAGE_HERO_EDGE = 960;
const COLLAGE_EDGE = 600;

interface SketchShowcaseProps {
  year: number;
  /** 모든 해의 여행. 작년과 견주는 데도 쓴다. */
  all: SketchTrip[];
  /** 이 해에 적어 둔 한 줄. 없으면 화면이 지어 낸다. */
  written: string | undefined;
  onWrite: (year: number, line: string) => Promise<boolean>;
  /** 시도를 가리는 셈. 불러오기 전에는 없다. */
  sidoOf: SidoOf | undefined;
  /** 로그인한 사람. 있어야 링크로 보여 줄 수 있다. */
  userId?: string | null;
}

export function SketchShowcase({ year, all, written, onWrite, sidoOf, userId = null }: SketchShowcaseProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState<"card" | "story" | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);
  /** Escape 로 버리는 중이면 손을 뗄 때 저장하지 않는다. */
  const cancelling = useRef(false);
  const chosen = useSyncExternalStore(subscribeCardStyle, readCardStyle, () => "map" as const);

  const trips = useMemo(() => tripsOfYear(all, year), [all, year]);
  const sketch = useMemo(() => buildSketch(trips), [trips]);
  const shapes = useMemo(() => sketchShapes(trips), [trips]);
  const months = useMemo(() => monthStrip(trips), [trips]);
  const story = useMemo(() => yearStory(all, year, sidoOf), [all, year, sidoOf]);
  const made = useMemo(() => headline(sketch, "year"), [sketch]);
  /*
    링크로 보여 줄 한 줄. 화면이 지은 말에는 함께한 사람의 이름이 들어갈
    수 있어("민지와 세 번") 이름 없는 말로 바꾼다. 직접 적어 둔 한 줄은
    본인이 고른 말이라 그대로 싣고, 창에서 그 사실을 알린다.
  */
  const sharedLine = written ?? headline(sketch, "year", { people: false });
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

  /*
    콜라주에 얹을 곳. 사진이 한 장도 없는 해에는 콜라주를 고를 수 없고,
    예전에 콜라주를 골라 뒀어도 지도로 보인다.
  */
  const picks = useMemo(() => collagePicks(shapes.dots), [shapes]);
  const style: CardStyle = chosen === "collage" && picks.length === 0 ? "map" : chosen;

  /*
    콜라주 사진은 콜라주를 골랐을 때만 받는다. 칸이 크므로 핀용 작은 판이
    아니라 목록 판에서 심는다. 받는 대로 한 칸씩 채운다 — 아홉 장을 다
    받을 때까지 빈 판을 보여 줄 이유가 없다.
  */
  const [collagePhotos, setCollagePhotos] = useState<Map<string, string>>(new Map());
  const [collageBusy, setCollageBusy] = useState(false);
  useEffect(() => {
    const supabase = getBrowserClient();
    if (style !== "collage" || !supabase) return;
    const paths = picks.map((pick) => pick.photoPath!).filter((path) => !collagePhotos.has(path));
    if (paths.length === 0) return;
    let active = true;
    void (async () => {
      setCollageBusy(true);
      try {
        const urls = await thumbUrls(supabase, paths);
        for (const path of paths) {
          const url = urls.get(path);
          if (!url) continue;
          const hero = path === picks[0]?.photoPath;
          const data = await inlinePhoto(url, {
            edge: hero ? COLLAGE_HERO_EDGE : COLLAGE_EDGE,
            square: false,
            quality: 0.8,
          });
          if (!active) return;
          if (data) setCollagePhotos((current) => new Map(current).set(path, data));
        }
      } catch {
        // 못 받은 칸은 빈 칸으로 남는다.
      } finally {
        if (active) setCollageBusy(false);
      }
    })();
    return () => {
      active = false;
    };
    // 받아 둔 사진이 늘 때마다 다시 돌 이유는 없다. 모양이나 고를 곳이 바뀔 때만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, picks]);

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

  const [sharing, setSharing] = useState(false);
  // 창의 Esc 는 onClose 가 바뀔 때마다 다시 건다. 같은 함수를 넘긴다.
  const closeShare = useCallback(() => setSharing(false), []);
  const shareSource = useMemo(
    () => yearShareSource({ year, style, headline: sharedLine, sketch, shapes, months, story }),
    [year, style, sharedLine, sketch, shapes, months, story],
  );
  /** 링크 미리보기에 쓸, 이미 받아 둔 사진들. */
  const localPhotos = useMemo(() => new Map([...cardPhotos, ...collagePhotos]), [cardPhotos, collagePhotos]);
  /* 콜라주 사진을 얹는 중에 저장하면 빈 칸이 찍힌다. 다 얹을 때까지 기다린다. */
  const waitingPhotos = style === "collage" && collageBusy;

  const save = async (kind: "card" | "story") => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    setSaving(kind);
    setFailed(false);
    const base = `여행스케치-${title}${styleSuffix(style)}`;
    const name = kind === "story" ? `${base}-세로.png` : `${base}.png`;
    const ok = await downloadSvgAsPng(svg, name, {
      story: kind === "story",
      background: style === "line" ? PAPER : undefined,
    });
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
          note={
            style === "line"
              ? "다 되면 저절로 받아져요."
              : "사진을 얹은 카드라 조금 걸려요. 다 되면 저절로 받아져요."
          }
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

      {/*
        카드 모양. 같은 한 해라도 보여 줄 곳에 따라 어울리는 모양이 다르다.
        고른 모양 그대로 저장된다.
      */}
      <div className="flex flex-col gap-2">
        <div role="radiogroup" aria-label="카드 모양" className="flex gap-1.5">
          {CARD_STYLES.map((option) => {
            const blocked = option.id === "collage" && picks.length === 0;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={option.id === style}
                disabled={blocked}
                onClick={() => keepCardStyle(option.id)}
                className={`flex-1 rounded-xl px-2 py-2 text-[14px] font-medium transition disabled:opacity-40 ${
                  option.id === style
                    ? "bg-text text-bg"
                    : "bg-bg-subtle text-text-muted hover:bg-line hover:text-text"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-text-faint">
          {picks.length === 0 && chosen === "collage"
            ? "이 해에는 올린 사진이 없어 지도로 보여 드려요."
            : CARD_STYLES.find((option) => option.id === style)?.hint}
          {style === "collage" && collageBusy && " · 사진을 얹고 있어요…"}
        </p>
      </div>

      <div ref={holder} className="overflow-hidden rounded-2xl ring-1 ring-line">
        {style === "collage" ? (
          <CollageCard sketch={sketch} title={title} headline={line} picks={picks} photos={collagePhotos} />
        ) : style === "line" ? (
          <LineCard sketch={sketch} shapes={shapes} year={year} headline={line} months={months} />
        ) : (
          <SketchCard
            sketch={sketch}
            shapes={shapes}
            title={title}
            headline={line}
            months={months}
            region={null}
            photos={cardPhotos}
          />
        )}
      </div>

      <StoryScenes story={story} photoUrls={sceneUrls} />

      {/*
        저장은 늘 손 닿는 데. 어디까지 읽어 내려가든 그 자리에서 저장한다.
        공유는 대개 세로라 스토리용을 따로 둔다. 그림 대신 링크로 보내면
        받는 사람이 그해 이야기까지 넘겨 볼 수 있다.
      */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-col gap-1.5 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        {failed && <p className="text-[13px] text-text-muted">저장하지 못했어요.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save("card")}
            disabled={saving !== null || waitingPhotos}
            aria-label={`${year}년 이미지 저장`}
            className="flex-1 rounded-full bg-accent px-1.5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            이미지 저장
          </button>
          <button
            type="button"
            onClick={() => void save("story")}
            disabled={saving !== null || waitingPhotos}
            className="flex-1 rounded-full bg-bg-subtle px-1.5 py-2.5 text-[14px] font-medium text-text transition hover:bg-line disabled:opacity-60"
          >
            스토리용 세로
          </button>
          {userId && (
            <button
              type="button"
              onClick={() => setSharing(true)}
              disabled={saving !== null || waitingPhotos}
              aria-label={`${year}년 링크로 보여 주기`}
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
          ownLine={written !== undefined}
          localPhotos={localPhotos}
          onClose={closeShare}
        />
      )}
    </article>
  );
}
