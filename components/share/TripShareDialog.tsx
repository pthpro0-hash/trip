"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  fetchOwnTripShare,
  publishTripShare,
  revokeTripShare,
  type OwnTripShare,
} from "@/lib/supabase/tripShares";
import type { TripDetail } from "@/lib/supabase/tripDetail";
import { tripShareTitle, buildTripSnapshot } from "@/lib/tripShare";
import { HubDialog } from "@/components/hub/HubDialog";
import { WaitingOverlay } from "@/components/layout/Waiting";

/*
  여행 하나를 링크로 보여 주기.

  고를 것이 없다 — 이 여행 하나를 사진까지 보여 준다. 링크를 아는 사람은
  이 여행만 볼 수 있고, 내 다른 여행이나 기록에는 닿지 못한다. 만든 순간의
  모습이라 고친 내용은 "새로 고치기"를 눌러야 바뀐다.
*/

interface TripShareDialogProps {
  userId: string;
  trip: TripDetail;
  onClose: () => void;
}

type Loaded = OwnTripShare | null | "loading" | "failed";

const linkOf = (id: string) => `${window.location.origin}/t/${id}`;

const dayOf = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function TripShareDialog({ userId, trip, onClose }: TripShareDialogProps) {
  const [existing, setExisting] = useState<Loaded>("loading");
  const [working, setWorking] = useState<{ kind: "publish" | "revoke"; done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;
    void fetchOwnTripShare(supabase, userId, trip.id).then((found) => {
      if (active) setExisting(found);
    });
    return () => {
      active = false;
    };
  }, [userId, trip.id]);

  const current = existing && existing !== "loading" && existing !== "failed" ? existing : null;
  const photoCount = trip.visits.reduce((sum, visit) => sum + visit.photos.length, 0);
  const title = tripShareTitle(buildTripSnapshot(trip, new Map()));

  const publish = async () => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    setFailed(null);
    setWorking({ kind: "publish", done: 0, total: photoCount });
    const published = await publishTripShare(supabase, userId, trip, current, (done, total) =>
      setWorking({ kind: "publish", done, total }),
    );
    if (!published) {
      setWorking(null);
      setFailed("링크를 만들지 못했어요. 잠시 후 다시 해 주세요.");
      return;
    }
    if (!published.clean) {
      setFailed("링크는 고쳤지만 예전 사진을 다 지우지 못했어요. '지금 모습으로 새로 고치기'를 한 번 더 눌러 주세요.");
    }
    const found = await fetchOwnTripShare(supabase, userId, trip.id);
    setExisting(
      found === "failed" || found === null ? { id: published.id, updatedAt: new Date().toISOString() } : found,
    );
    setWorking(null);
  };

  const revoke = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !current) return;
    setFailed(null);
    setWorking({ kind: "revoke", done: 0, total: 0 });
    const ok = await revokeTripShare(supabase, current);
    setWorking(null);
    setConfirmRevoke(false);
    if (!ok) {
      setFailed("링크를 끊지 못했어요. 다시 눌러 주세요.");
      return;
    }
    setExisting(null);
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
      await navigator.share({ title, url: linkOf(current.id) });
    } catch {
      // 공유 창을 닫은 것뿐이다.
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <HubDialog label="이 여행 링크로 보여 주기" onClose={onClose}>
      {working && (
        <WaitingOverlay
          title={working.kind === "revoke" ? "링크를 끊고 있어요" : "링크를 만들고 있어요"}
          detail={working.total > 0 ? `사진 ${working.done}장 / ${working.total}장` : undefined}
          note={
            working.kind === "revoke" ? "옮겨 둔 사진을 지우는 중이에요." : "보여 줄 사진을 따로 옮겨 두는 중이에요."
          }
        />
      )}

      <div className="flex flex-col gap-5 pr-8">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text">이 여행을 링크로 보여 주기</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-text-muted">
            링크를 아는 사람은 <strong className="text-text">이 여행 하나만</strong> 볼 수 있어요. 내 다른 여행이나
            기록은 보이지 않고, 검색에도 나오지 않아요. 언제든 끊을 수 있어요.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5">
        {current && (
          <section className="flex flex-col gap-3 rounded-2xl bg-accent-soft p-4">
            <p className="text-[14px] font-semibold text-accent">
              링크로 보여 주는 중{dayOf(current.updatedAt) && ` · ${dayOf(current.updatedAt)} 모습`}
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
                href={`/t/${current.id}`}
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
          <p className="text-[13px] font-semibold text-text-faint">받는 사람에게 보이는 것</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px] leading-relaxed text-text-muted">
            <li>여행 제목과 부제, 여행 기간, 다녀온 곳 이름과 간 날</li>
            <li>사진 {photoCount}장과 지도의 코스 (위치는 약 1km 단위로 뭉개서 실려요)</li>
          </ul>
          <p className="text-[13px] leading-relaxed text-text-muted">
            함께한 사람 이름과 적어 둔 메모는 싣지 않아요. 만든 순간의 모습이라, 나중에 고친 내용은 &quot;새로
            고치기&quot;를 눌러야 바뀌어요.
          </p>
        </section>

        {failed && <p className="text-[14px] text-text-muted">{failed}</p>}

        <div className="flex flex-col gap-2">
          {existing === "failed" && (
            <p className="text-[13px] text-text-muted">
              만들어 둔 링크를 확인하지 못했어요. 새로 만들면 이 여행의 링크를 고쳐 써요.
            </p>
          )}
          <button
            type="button"
            onClick={() => void publish()}
            disabled={existing === "loading" || working !== null}
            className="rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
          >
            {current ? "지금 모습으로 새로 고치기" : "링크 만들기"}
          </button>
          {current && <p className="text-center text-[12px] text-text-faint">고쳐 만들어도 링크 주소는 그대로예요.</p>}

          {current &&
            (confirmRevoke ? (
              <div className="mt-2 flex flex-col gap-2 rounded-2xl bg-bg-subtle p-4">
                <p className="text-[14px] text-text">
                  끊으면 이 링크로는 다시 볼 수 없고, 옮겨 둔 사진도 지워져요. 다시 만들면 새 주소가 돼요. 카톡처럼
                  이미 링크가 올라간 곳의 미리보기는 그 앱에 한동안 남을 수 있어요.
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
