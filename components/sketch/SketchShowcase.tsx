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
import { canIn, useFamilyView } from "@/lib/familyView";
import { SketchCard } from "./SketchCard";
import { CollageCard } from "./CollageCard";
import { LineCard } from "./LineCard";
import { StoryScenes } from "./StoryScenes";
import { FootprintPlayer } from "./FootprintPlayer";
import { footprintSteps, tripsPerMonth } from "@/lib/footprint";
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
  여기서는 한 해를 작품으로 보여 준다. 맨 위가 카드다 — 그해의 한 줄은 카드 안에
  이미 크게 있어서 카드 위에 같은 문장을 또 적지 않는다(폰의 첫 화면을 반복이
  차지하고 카드가 아래로 밀렸다). 카드 바로 아래 한 줄에 모양 고르기와 한 줄
  고쳐 쓰기를 모으고, 더 내려가면 그해가 어땠는지를 장면마다 풀어 말한다.

  저장 단추는 늘 화면 아래에 붙어 있다. 어디까지 읽어 내려가든, 마음에
  들면 그 자리에서 바로 저장할 수 있어야 한다.
*/

/*
  지도 위에 얹을 사진을 받아 둘 자리 수. 카드가 겹치지 않는 것만 골라
  얹으므로 얹을 수보다 넉넉히 받는다.
*/
const PHOTOS_ON_MAP = 10;

/* 장면에는 따로 큰 사진을 두지 않는다. 곳 줄의 작은 사진은 placeUrls 가 맡는다. */
const NO_PHOTOS = new Map<string, string>();

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
  // 가족의 여행에서는 한 줄을 고칠 수 있는 권한이 있어야 쓴다.
  const canEdit = canIn(useFamilyView(), "edit");
  const [saving, setSaving] = useState(false);
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

  /*
    "그해의 곳들"의 사진. 줄마다 손톱만 하게 보이므로 핀용 작은 판(160px)이면
    된다 — 카드가 이미 받은 것과 같은 판이라 주소도 같고, 브라우저가 가진 것을
    그대로 쓴다. 큰 판을 열 장씩 받으면 한장 요약을 열 때마다 1MB 가까이 든다.
    "더 보기"에 숨은 곳까지 주소만 미리 받아 둔다(사진은 펼칠 때 받는다).
  */
  const steps = useMemo(() => footprintSteps(trips), [trips]);
  const stepMonths = useMemo(() => tripsPerMonth(steps), [steps]);
  // 발자취의 점을 눌렀을 때 보이는 사진도 같은 작은 판이다.
  const placePaths = useMemo(
    () => [
      ...new Set(
        [...story.places.map((place) => place.photoPath), ...steps.map((step) => step.photoPath)].filter(
          (path): path is string => !!path,
        ),
      ),
    ],
    [story, steps],
  );
  const [placeUrls, setPlaceUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase || placePaths.length === 0) return;
    let active = true;
    void markerUrls(supabase, placePaths)
      .then((urls) => {
        if (active) setPlaceUrls(urls);
      })
      .catch(() => {
        // 사진을 못 받아도 곳 이름과 날짜는 보인다. 자리표시가 남을 뿐이다.
      });
    return () => {
      active = false;
    };
  }, [placePaths]);

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

  const save = async () => {
    const svg = holder.current?.querySelector("svg");
    if (!svg) return;
    setSaving(true);
    setFailed(false);
    const ok = await downloadSvgAsPng(svg, `여행스케치-${title}${styleSuffix(style)}.png`);
    if (!ok) setFailed(true);
    setSaving(false);
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
        카드가 맨 위다. 열자마자 보여야 하는 것은 결과이고, 모양을 바꾸는 것은 그다음
        일이다 — 고르는 줄이 카드 위에 있으면 첫 화면이 설정으로 시작한다. 그해의 한 줄은
        카드 안에 이미 가장 크게 있다.
      */}
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

      {/*
        카드 아래 한 줄 — 카드 모양 고르기와 한 줄 고쳐 쓰기. 같은 한 해라도 보여 줄 곳에 따라 어울리는
        모양이 다르고, 고른 모양 그대로 저장된다. 바로 위 카드의 것이라 카드에 붙여 둔다. 모양 이름은
        지도·사진 콜라주·선 그림이면 뜻이 읽혀서 설명 문장은 달지 않는다.

        그해의 한 줄은 화면이 먼저 지어 두지만 그해가 어땠는지는 본인만 안다 — 고쳐 쓰면 그 말이 카드에도
        들어간다. 고치는 중에는 이 줄이 입력칸으로 바뀐다.
      */}
      <div className="-mt-2 flex flex-col gap-2">
        {editing ? (
          <>
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
              className="w-full rounded-xl bg-bg-subtle px-3.5 py-3 text-[18px] font-bold tracking-tight text-text outline-none ring-1 ring-line placeholder:font-normal placeholder:text-text-faint focus:ring-2 focus:ring-accent"
            />
            <p className="text-[13px] text-text-faint">비우면 화면이 지은 말로 돌아가요. Esc 로 취소.</p>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div role="radiogroup" aria-label="카드 모양" className="flex min-w-0 flex-1 gap-1.5">
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
                    className={`min-w-0 flex-1 rounded-xl px-1.5 py-2 text-[14px] font-medium transition disabled:opacity-40 ${
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
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="한 줄 고쳐 쓰기"
                className="shrink-0 rounded-xl bg-bg-subtle px-3 py-2 text-[14px] font-medium text-accent transition hover:bg-line"
              >
                <span aria-hidden="true">✎</span> 한 줄
              </button>
            )}
          </div>
        )}
        {writeFailed && <p className="text-[13px] text-text-muted">적어두지 못했어요.</p>}
        {picks.length === 0 && chosen === "collage" && (
          <p className="text-[13px] text-text-faint">이 해에는 올린 사진이 없어 지도로 보여 드려요.</p>
        )}
        {style === "collage" && collageBusy && <p className="text-[13px] text-text-faint">사진을 얹고 있어요…</p>}
      </div>

      <FootprintPlayer
        steps={steps}
        monthCounts={stepMonths}
        totals={{ trips: story.tripCount, places: story.placeCount, photos: story.photoCount }}
        photoUrls={placeUrls}
        backHref={`/sketch?y=${year}`}
      />

      {/* 곳을 눌러 상세로 갔다가 돌아오면 보던 해의 한장 요약으로 선다. */}
      <StoryScenes story={story} photoUrls={NO_PHOTOS} placeUrls={placeUrls} backHref={`/sketch?y=${year}`} />

      {/*
        저장은 늘 손 닿는 데. 어디까지 읽어 내려가든 그 자리에서 저장한다.
        그림 대신 링크로 보내면 받는 사람이 그해 이야기까지 넘겨 볼 수 있다.
      */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex flex-col gap-1.5 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
        {failed && <p className="text-[13px] text-text-muted">저장하지 못했어요.</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || waitingPhotos}
            aria-label={`${year}년 이미지 저장`}
            className="flex-1 rounded-full bg-accent px-1.5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            이미지 저장
          </button>
          {userId && (
            <button
              type="button"
              onClick={() => setSharing(true)}
              disabled={saving || waitingPhotos}
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
