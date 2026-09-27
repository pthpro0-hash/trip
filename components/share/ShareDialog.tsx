"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CardStyle } from "@/lib/cardStyle";
import type { MonthCell, Sketch, SketchShapes } from "@/lib/sketch";
import type { YearStory } from "@/lib/sketchStory";
import { SHARE_SCOPES, buildSnapshot, sharePhotoPaths, type ShareScope } from "@/lib/share";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchOwnShare, publishShare, revokeShare, type OwnShare } from "@/lib/supabase/shares";
import { markupToPngBlob } from "@/lib/svgToPng";
import { PREVIEW, linkPreviewMarkup } from "@/lib/linkPreview";
import { HubDialog } from "@/components/hub/HubDialog";
import { WaitingOverlay } from "@/components/layout/Waiting";
import { PAPER } from "@/components/sketch/cardInk";
import { SharedCard } from "./SharedCard";

/*
  한 해를 링크로 보여 주기.

  고르는 것은 딱 하나 — 어디까지 보여 줄지. 고르면 아래 미리보기가 곧
  남이 볼 모습으로 바뀐다. 보고 나서 만든다.

  한 해에 링크 하나다. 이미 만들어 두었으면 그 링크를 보여 주고, 고쳐
  만들면 같은 링크의 내용만 바뀐다. 끊으면 그 링크는 되살아나지 않는다.
*/

interface ShareDialogProps {
  userId: string;
  year: number;
  style: CardStyle;
  /** 싣는 한 줄. 화면이 지은 말이면 이미 이름을 뺀 것이다. */
  headline: string;
  /** 직접 적어 둔 한 줄인가. 그렇다면 그대로 실린다고 알린다. */
  ownLine?: boolean;
  sketch: Sketch;
  shapes: SketchShapes;
  months: MonthCell[];
  story: YearStory;
  /** 이미 받아 둔 사진 그림 글자(원본 경로 → data URI). 미리보기와 미리보기 그림에 쓴다. */
  localPhotos: Map<string, string>;
  onClose: () => void;
}

type Loaded = OwnShare | null | "loading" | "failed";

const linkOf = (id: string) => `${window.location.origin}/s/${id}`;

const dayOf = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function ShareDialog(props: ShareDialogProps) {
  const { userId, year, style, headline, ownLine = false, sketch, shapes, months, story, localPhotos, onClose } = props;
  const [existing, setExisting] = useState<Loaded>("loading");
  const photoPaths = useMemo(() => sharePhotoPaths(shapes, story), [shapes, story]);
  const blocked = (scope: ShareScope) =>
    (scope === "photos" && photoPaths.length === 0) || (scope === "sido" && story.sido.length === 0);
  const [picked, setPicked] = useState<ShareScope | null>(null);
  const [working, setWorking] = useState<{ kind: "publish" | "revoke"; done: number; total: number } | null>(
    null,
  );
  const [failed, setFailed] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [copied, setCopied] = useState(false);
  const preview = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;
    void fetchOwnShare(supabase, userId, year).then((found) => {
      if (active) setExisting(found);
    });
    return () => {
      active = false;
    };
  }, [userId, year]);

  const current = existing !== "loading" && existing !== "failed" ? existing : null;
  /** 고르지 않았으면 만들어 둔 링크의 범위, 그것도 없으면 사진까지(못 고르면 지도만). */
  const scope: ShareScope = picked ?? current?.scope ?? (blocked("photos") ? "map" : "photos");

  // 미리보기는 파일 이름 대신 원본 경로를 그대로 쓴다 — 그래야 받아 둔 그림 글자로 그린다.
  const draft = useMemo(
    () =>
      buildSnapshot({
        year,
        scope,
        style,
        headline,
        sketch,
        shapes,
        months,
        story,
        files: new Map(photoPaths.map((path) => [path, path])),
        cover: null,
      }),
    [year, scope, style, headline, sketch, shapes, months, story, photoPaths],
  );

  const publish = async () => {
    const supabase = getBrowserClient();
    const svg = preview.current?.querySelector("svg");
    if (!supabase || !svg || existing === "loading") return;
    setFailed(null);
    setConfirmRevoke(false);
    const uploads = scope === "photos" ? photoPaths : [];
    setWorking({ kind: "publish", done: 0, total: uploads.length });

    // 카톡 미리보기 그림. 못 만들어도 링크는 만든다.
    const cover = await markupToPngBlob(
      linkPreviewMarkup(svg, {
        background: draft.card === "line" ? "#e9e2d3" : "#eef0f3",
        kicker: `${year}년 여행 스케치`,
        headline,
      }),
      PREVIEW,
    );
    const published = await publishShare(supabase, {
      userId,
      year,
      scope,
      existing: current,
      photoPaths: uploads,
      cover,
      build: (files, coverName) =>
        buildSnapshot({ year, scope, style, headline, sketch, shapes, months, story, files, cover: coverName }),
      onProgress: (done, total) => setWorking({ kind: "publish", done, total }),
    });
    if (!published) {
      setWorking(null);
      setFailed("링크를 만들지 못했어요. 잠시 후 다시 해 주세요.");
      return;
    }
    if (!published.clean) {
      setFailed("링크는 고쳤지만 예전 사진을 다 지우지 못했어요. '지금 모습으로 새로 고치기'를 한 번 더 눌러 주세요.");
    }
    const found = await fetchOwnShare(supabase, userId, year);
    setExisting(found === "failed" ? current : found);
    setPicked(null);
    setWorking(null);
  };

  const revoke = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !current) return;
    setFailed(null);
    setWorking({ kind: "revoke", done: 0, total: 0 });
    const ok = await revokeShare(supabase, current);
    setWorking(null);
    setConfirmRevoke(false);
    if (!ok) {
      setFailed("링크를 끊지 못했어요. 다시 눌러 주세요.");
      return;
    }
    setExisting(null);
    setPicked(null);
  };

  const copy = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(linkOf(current.id));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed("복사하지 못했어요. 주소를 길게 눌러 복사해 주세요.");
    }
  };

  const send = async () => {
    if (!current) return;
    try {
      await navigator.share({ title: `${year}년 여행 스케치`, text: headline, url: linkOf(current.id) });
    } catch {
      // 공유 창을 닫은 것뿐이다.
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  /** 만들어 둔 링크와 지금 고른 범위가 다르면, 고쳐 만들어야 그 범위가 된다. */
  const changed = current !== null && current.scope !== scope;

  return (
    <HubDialog label={`${year}년 링크로 보여 주기`} onClose={onClose}>
      {working && (
        <WaitingOverlay
          title={working.kind === "revoke" ? "링크를 끊고 있어요" : "링크를 만들고 있어요"}
          detail={working.total > 0 ? `사진 ${working.done}장 / ${working.total}장` : undefined}
          note={
            working.kind === "revoke"
              ? "옮겨 둔 사진을 지우는 중이에요."
              : "보여 줄 사진과 미리보기 그림을 따로 옮겨 두는 중이에요."
          }
        />
      )}

      <div className="flex flex-col gap-5 pr-8">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text">{year}년을 링크로 보여 주기</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-text-muted">
            링크를 아는 사람만 볼 수 있어요. 검색에는 나오지 않고, 언제든 끊을 수 있어요.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {current && (
          <section className="flex flex-col gap-3 rounded-2xl bg-accent-soft p-4">
            <p className="text-[14px] font-semibold text-accent">
              링크로 보여 주는 중 · {SHARE_SCOPES.find((option) => option.id === current.scope)?.label}
              {dayOf(current.updatedAt) && ` · ${dayOf(current.updatedAt)} 모습`}
            </p>
            <p className="break-all rounded-xl bg-surface px-3 py-2.5 text-[14px] text-text select-all">
              {linkOf(current.id)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
              >
                {copied ? "복사했어요" : "링크 복사"}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={() => void send()}
                  className="rounded-full bg-surface px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line transition hover:bg-bg-subtle"
                >
                  보내기
                </button>
              )}
              <a
                href={`/s/${current.id}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-surface px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line transition hover:bg-bg-subtle"
              >
                열어 보기
              </a>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-text-faint">어디까지 보여 줄까요</p>
          <div role="radiogroup" aria-label="보여 줄 범위" className="flex gap-1.5">
            {SHARE_SCOPES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={option.id === scope}
                disabled={blocked(option.id)}
                onClick={() => setPicked(option.id)}
                className={`flex-1 rounded-xl px-2 py-2 text-[14px] font-medium transition disabled:opacity-40 ${
                  option.id === scope
                    ? "bg-text text-bg"
                    : "bg-bg-subtle text-text-muted hover:bg-line hover:text-text"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-text-muted">
            {SHARE_SCOPES.find((option) => option.id === scope)?.hint} 함께한 사람과 날짜는 어느 쪽이든
            싣지 않아요.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-text-faint">받는 사람에게 이렇게 보여요</p>
          {ownLine && (
            <p className="text-[13px] leading-relaxed text-text-muted">
              맨 위 한 줄은 적어 두신 그대로 실려요. 다른 사람 이름이 들어 있다면 먼저 고쳐 주세요.
            </p>
          )}
          <div
            ref={preview}
            className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl ring-1 ring-line"
            style={draft.card === "line" ? { background: PAPER } : undefined}
          >
            <SharedCard snapshot={draft} photos={localPhotos} />
          </div>
        </section>

        {failed && <p className="text-[14px] text-text-muted">{failed}</p>}

        <div className="flex flex-col gap-2">
          {existing === "failed" && (
            <p className="text-[13px] text-text-muted">만들어 둔 링크를 확인하지 못했어요. 새로 만들면 같은 해의 링크를 고쳐 써요.</p>
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={existing === "loading" || working !== null}
            className="rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            {current ? (changed ? "이 범위로 고쳐 만들기" : "지금 모습으로 새로 고치기") : "링크 만들기"}
          </button>
          {current && (
            <p className="text-center text-[12px] text-text-faint">고쳐 만들어도 링크 주소는 그대로예요.</p>
          )}

          {current &&
            (confirmRevoke ? (
              <div className="mt-2 flex flex-col gap-2 rounded-2xl bg-bg-subtle p-4">
                <p className="text-[14px] text-text">
                  끊으면 이 링크로는 다시 볼 수 없고, 옮겨 둔 사진도 지워져요. 다시 만들면 새 주소가 돼요.
                  카톡처럼 이미 링크가 올라간 곳의 미리보기 그림은 그 앱에 한동안 남을 수 있어요.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void revoke()}
                    className="rounded-full bg-text px-4 py-2 text-[14px] font-medium text-bg"
                  >
                    링크 끊기
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRevoke(false)}
                    className="rounded-full bg-surface px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line"
                  >
                    그대로 두기
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className="mt-1 self-center text-[14px] font-medium text-text-muted underline-offset-2 hover:text-text hover:underline"
              >
                링크 끊기…
              </button>
            ))}
        </div>
      </div>
    </HubDialog>
  );
}
