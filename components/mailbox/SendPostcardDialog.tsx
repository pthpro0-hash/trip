"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";
import { createMailbox, fetchMailboxes, type MailboxInput, type MailboxItem } from "@/lib/supabase/mailbox";
import { sendPostcard, type SendPostcardResult } from "@/lib/supabase/postcards";
import type { TripDetail } from "@/lib/supabase/tripDetail";
import { BODY_MAX, greetingsFor, pickPostcardPhotos, suggestionsFor, type Tone } from "@/lib/mailbox";
import { firstShelfInput, firstShelfItem } from "@/lib/mailboxFirst";
import { attachParticle } from "@/lib/korean";
import { sendLimits } from "@/lib/mailboxSettings";
import { HubDialog } from "@/components/hub/HubDialog";
import { WaitingOverlay } from "@/components/layout/Waiting";
import { FirstShelfForm } from "./send/FirstShelfForm";
import { PhotoPicker } from "./send/PhotoPicker";
import { PostcardPreview } from "./send/PostcardPreview";
import { SentDone } from "./send/SentDone";
import { ShelfList } from "./send/ShelfList";

/*
  엽서 보내기 — 이 여행을 부모님께.

  한 줄기로 간다: (처음이면 누구에게 보내는지 한 가지만 묻고) → 한 줄을 쓰면 위의 엽서 미리보기가 바로 바뀐다 → [엽서 만들기]
  → 링크를 보낸다. 사진과 받는 곳·인사말은 자동으로 채워 접어 두었다 — 바꾸고 싶은 사람만 연다.

  인사말은 책장마다 따로다 — 한 번 쓰면 다른 책장에 복사되고 호칭만 그 책장 것으로 바뀐다. 직접 고친 책장은 따로 간다.
  보내면 엽서는 그 순간의 모습으로 남는다(사진은 한 번만 복사한다).

  링크 보내기는 폰의 공유창(카카오톡이 목록에 나온다)을 연다. 안 되는 브라우저에서는 링크 복사(SentDone).
*/

interface SendPostcardDialogProps {
  userId: string;
  trip: TripDetail;
  /** 원본 보관 경로 → 목록 판 주소. 사진을 고르는 칸에 보여 준다. */
  photoUrls: Map<string, string>;
  onClose: () => void;
}

const NAME_KEY = "postcard-sender-name";

/** 이름 기억: 저장소가 막힌 브라우저에서도 보내기는 된다. */
function remembered(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

type Sent = { postcardId: string; boxes: { box: MailboxItem; greeting: string }[]; senderName: string };

const REASON: Record<Extract<SendPostcardResult, { ok: false }>["reason"], string> = {
  invalid: "받을 책장, 한 줄, 보내는 이름을 확인해 주세요.",
  photos: "사진을 옮기지 못했어요. 인터넷이 약한가 봐요. 잠시 뒤 다시 해 주세요. (엽서는 나가지 않았어요)",
  failed: "보내지 못했어요. 잠시 뒤 다시 해 주세요. (엽서는 나가지 않았어요)",
};

/** 처음 책장을 만들다 안 됐을 때. 책장이라는 말을 모르는 사람도 읽을 수 있게 쓴다. */
const CREATE_REASON = {
  invalid: "받는 분을 다시 적어 주세요. 예: 엄마, 아빠",
  limit: "더 만들 수 없어요. ‘내 정보’의 ‘가족 책장’에서 쓰지 않는 곳을 닫은 뒤 다시 해 주세요.",
  failed: "저장하지 못했어요. 인터넷을 확인하고 다시 눌러 주세요.",
} as const;

/** 창 맨 위 글. 받는 곳이 하나로 정해졌으면 그분께, 아니면 그냥 부모님께. */
function titleFor(selected: MailboxItem[]): string {
  const name = selected.length === 1 ? selected[0].greetingName?.trim() : "";
  return `${name || "부모님"}께 엽서 보내기`;
}

export function SendPostcardDialog({ userId, trip, photoUrls, onClose }: SendPostcardDialogProps) {
  const [boxes, setBoxes] = useState<MailboxItem[] | "loading" | "failed">("loading");
  const [senderName, setSenderName] = useState("");
  const [body, setBody] = useState("");
  const photos = useMemo(
    () => trip.visits.flatMap((visit) => visit.photos.map((photo) => ({ ...photo, visitId: visit.id }))),
    [trip],
  );
  /** 직접 고른 사진. null 이면 자동으로 고른 것(곳마다 골고루)을 쓴다. */
  const [manual, setManual] = useState<string[] | null>(null);
  const [checked, setChecked] = useState<Set<string> | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<{ done: number; total: number } | null>(null);
  /** 보내다 실패한 까닭(서버 쪽). 다음에 누를 때까지 남는다. */
  const [failure, setFailure] = useState<string | null>(null);
  /** [엽서 만들기]를 눌러 본 적이 있는가. 그러면 빠진 것을 그때그때 알리고, 채우면 알림이 사라진다. */
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const nameId = useId();
  /*
    책장을 방금 만들어 '누구에게' 화면이 사라지고 엽서 쓰기로 넘어오면, 눌렀던 단추가 없어져 초점이 갈 곳을 잃는다 — 새 제목으로
    옮겨 화면 낭독기가 새 걸음을 읽게 한다. (엽서를 열 때부터 글칸에 초점을 주지는 않는다: 폰에서는 키보드가 바로 올라와 미리보기를 가린다.)
  */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [focusHeading, setFocusHeading] = useState(false);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const meta = data.user?.user_metadata ?? {};
        // 로그인 수단마다 이름이 들어 있는 칸이 다르다(카카오는 nickname 만 있기도 하다). 없으면 이메일 앞부분.
        const account = String(meta.full_name ?? meta.name ?? meta.nickname ?? meta.preferred_username ?? data.user?.email?.split("@")[0] ?? "")
          .trim()
          .split(/\s+/)[0]
          .slice(0, 20);
        if (active) setSenderName(remembered() || account);
        const list = await fetchMailboxes(supabase, userId);
        if (!active) return;
        if (list === "failed") return setBoxes("failed");
        // 닫은 책장에는 보낼 수 없다.
        setBoxes([...list.owned, ...list.joined].filter((box) => !box.closed));
      } catch {
        // 읽다가 끊겼다 — '불러오는 중…'에 영영 머물지 않게.
        if (active) setBoxes("failed");
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const openBoxes = Array.isArray(boxes) ? boxes : [];
  // 처음에는 열린 책장을 모두 고른 것으로 둔다. 하나뿐이면 더 쉽다.
  const selectedIds = checked ?? new Set(openBoxes.map((box) => box.id));
  const selected = openBoxes.filter((box) => selectedIds.has(box.id));
  const rows = greetingsFor(body, selected, overrides);
  const rowOf = (id: string) => rows.find((row) => row.mailboxId === id);

  /*
    이 책에 실을 수 있는 사진 수와 크기. 책장마다 설정이 다른데 사진 복사본은 하나라서, 고른 책장들 중
    가장 적은 수에, 가장 선명한 크기에 맞춘다(sendLimits).
  */
  const limits = sendLimits(selected.map((box) => box.settings));
  const auto = pickPostcardPhotos(photos, limits.photos).map((photo) => photo.id);
  const picked = (manual ?? auto).slice(0, limits.photos);
  const strictest = selected.filter((box) => box.settings.photos === limits.photos);
  const limitNote =
    limits.photos >= 20
      ? null
      : selected.length > 1 && strictest.length < selected.length
        ? `${attachParticle(strictest.map((box) => box.name).join(", "), "은", "는")} ${limits.photos}장까지라 ${limits.photos}장까지 고를 수 있어요.`
        : `책장 설정에 따라 ${limits.photos}장까지 고를 수 있어요.`;

  const togglePhoto = (id: string) =>
    setManual(
      picked.includes(id) ? picked.filter((entry) => entry !== id) : picked.length >= limits.photos ? picked : [...picked, id],
    );

  const toggleBox = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  // 엽서에는 여행 차례대로 실린다(sendPostcard) — 미리보기도 그 첫 사진을 보여 준다.
  const firstShot = photos.find((photo) => picked.includes(photo.id));
  const previewUrl = (firstShot && photoUrls.get(firstShot.storagePath)) || null;

  /** 한 줄 아래 추천 문구: 받는 곳이 정해진 말투로. 책장마다의 추천은 접힌 목록 안에 있다. */
  const tone: Tone = selected[0]?.tone ?? "casual";

  /*
    무엇이 빠졌는지. 단추를 흐리게 막아 두면 눌러도 아무 일이 없어 고장 난 것처럼 보인다 — 눌렀을 때
    빠진 것을 말로 알려 준다.
  */
  const missing =
    selected.length === 0
      ? "받을 책장을 골라 주세요."
      : body.trim().length === 0
        ? "한 줄을 적어 주세요. 받는 분께 가는 인사말이에요."
        : senderName.trim().length === 0
          ? "보내는 이름을 적어 주세요. 받는 분께 ‘○○이 보낸 엽서’로 보여요."
          : null;

  /** 아래 띠에 보이는 알림: 서버 쪽 실패가 먼저, 아니면 눌러 본 뒤로는 지금 빠진 것(채우면 사라진다). */
  const notice = failure ?? (tried ? missing : null);

  /** 처음 보내는 사람: 답 하나로 책장을 만들고 같은 창에서 이어 간다. */
  const createShelf = async ({ who, tone: answer }: { who: string; tone: Tone }) => {
    const supabase = getBrowserClient();
    const input: MailboxInput | null = firstShelfInput(who, answer);
    if (!supabase || !input || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      /*
        지난 시도가 서버에는 들어갔는데 답이 오다 끊겼다면('저장하지 못했어요'가 떴는데 사실은 만들어져 있다면) 다시 눌러 만들 때
        같은 책장이 둘이 된다 — 둘 다 받는 곳으로 골라져 부모님께 링크가 두 개 간다. 만들기 전에 한 번 더 읽어, 이미 열린
        책장이 있으면 새로 만들지 않고 그것을 쓴다.
      */
      const existing = await fetchMailboxes(supabase, userId);
      if (existing !== "failed") {
        const open = [...existing.owned, ...existing.joined].filter((box) => !box.closed);
        if (open.length > 0) {
          setBoxes(open);
          setFocusHeading(true);
          return;
        }
      }
      const result = await createMailbox(supabase, userId, input);
      if (!result.ok) {
        setCreateError(CREATE_REASON[result.reason]);
        return;
      }
      setBoxes([firstShelfItem(userId, input, result)]);
      setFocusHeading(true);
    } catch {
      // 통신이 끊겼다 — 단추가 '만드는 중…'에 영영 잠기지 않게 한다.
      setCreateError(CREATE_REASON.failed);
    } finally {
      setCreating(false);
    }
  };

  const send = async () => {
    const supabase = getBrowserClient();
    if (!supabase || working) return;
    if (missing) {
      setFailure(null);
      setTried(true);
      return;
    }
    setFailure(null);
    setTried(false);
    setWorking({ done: 0, total: picked.length });
    let result: SendPostcardResult;
    try {
      result = await sendPostcard(supabase, {
        senderId: userId,
        senderName,
        trip,
        photoIds: picked,
        maxPhotos: limits.photos,
        size: limits.size as 640 | 960,
        deliveries: rows.map((row) => ({ mailboxId: row.mailboxId, greeting: row.text })),
        onProgress: (done, total) => setWorking({ done, total }),
      });
    } catch {
      // 통신이 끊겼다 — 대기 화면이 영영 화면을 덮고 있지 않게, 나가지 않은 것으로 다룬다.
      result = { ok: false, reason: "failed" };
    }
    setWorking(null);
    if (!result.ok) {
      setFailure(REASON[result.reason]);
      return;
    }
    try {
      window.localStorage.setItem(NAME_KEY, senderName.trim());
    } catch {
      // 이름을 기억하지 못해도 보내기는 끝났다.
    }
    setSent({
      postcardId: result.postcardId,
      senderName: senderName.trim(),
      boxes: selected.map((box) => ({ box, greeting: rowOf(box.id)?.text ?? "" })),
    });
  };

  // 오른쪽 위의 ✕ 를 피해 제목만 오른쪽을 비운다. 아래 칸들은 창 폭을 다 쓴다.
  const heading = (
    <h2 ref={headingRef} tabIndex={-1} className="pr-9 text-[20px] font-bold tracking-tight text-text outline-none">
      {titleFor(selected)}
    </h2>
  );

  return (
    // 만드는 동안에는 닫지 못하게 한다 — 닫아 버리면 만든 엽서의 링크를 받을 길이 없다.
    <HubDialog label="엽서 보내기" onClose={onClose} locked={Boolean(working) || creating}>
      {working && (
        <WaitingOverlay
          title="엽서를 만들고 있어요"
          detail={working.total > 0 ? `사진 ${working.done}장 / ${working.total}장` : undefined}
          note="고른 사진을 엽서 보관함으로 옮기는 중이에요."
        />
      )}

      <div className="flex flex-col gap-5">
        {sent ? (
          <SentDone postcardId={sent.postcardId} senderName={sent.senderName} boxes={sent.boxes} onClose={onClose} />
        ) : boxes === "loading" ? (
          <>
            {heading}
            <p className="text-[14px] text-text-muted">불러오는 중…</p>
          </>
        ) : boxes === "failed" ? (
          <>
            {heading}
            <p className="text-[14px] text-text-muted">책장을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
          </>
        ) : boxes.length === 0 ? (
          <FirstShelfForm busy={creating} error={createError} onSubmit={(answer) => void createShelf(answer)} />
        ) : (
          <>
            <div>
              {heading}
              <p className="mt-1 text-[14px] leading-relaxed text-text-muted">받는 분은 링크 하나로, 로그인 없이 열어 봐요.</p>
            </div>

            <PostcardPreview photoUrl={previewUrl} text={rows[0]?.text ?? ""} senderName={senderName} />

            <section className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-text">한 줄</span>
                <textarea
                  value={body}
                  maxLength={BODY_MAX}
                  rows={2}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="강릉 바다 보고 왔어요. 다음엔 같이 가요!"
                  className="resize-y rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[16px] leading-relaxed text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {suggestionsFor(tone).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setBody((current) => `${current.trim()} ${suggestion}`.trim().slice(0, BODY_MAX))}
                    className="rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] text-text ring-1 ring-line hover:bg-line"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center gap-2.5">
              <label htmlFor={nameId} className="shrink-0 text-[14px] text-text-muted">
                보내는 이름
              </label>
              <input
                id={nameId}
                type="text"
                value={senderName}
                maxLength={20}
                onChange={(event) => setSenderName(event.target.value)}
                className="min-w-0 flex-1 rounded-lg bg-bg-subtle px-3 py-2 text-[16px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
              />
            </div>

            <PhotoPicker
              photos={photos}
              urls={photoUrls}
              picked={picked}
              limit={limits.photos}
              limitNote={limitNote}
              manual={manual !== null}
              onToggle={togglePhoto}
              onReset={() => setManual(null)}
            />

            <ShelfList
              boxes={openBoxes}
              selectedIds={selectedIds}
              rows={rows}
              onToggle={toggleBox}
              onEdit={(id, text) => setOverrides((current) => ({ ...current, [id]: text }))}
              onReset={(id) =>
                setOverrides((current) => {
                  const next = { ...current };
                  delete next[id];
                  return next;
                })
              }
              onSuggest={(id, suggestion, current) =>
                setOverrides((all) => ({ ...all, [id]: `${current.trim()} ${suggestion}`.trim() }))
              }
            />

            <p className="text-[12px] text-text-faint">
              엽서는 만든 순간 그대로 남아요. 이 여행이나 사진을 지우면 엽서에서도 사라져요.
            </p>

            {/*
              만들기 단추는 창 아래에 붙어 있다 — 사진 격자나 받는 곳 목록을 펼쳐 길어져도 찾아 헤매지 않게. 빠진 것을 알리는
              글도 여기 함께 둔다(위쪽에 두면 단추를 눌러도 화면 밖이라 아무 일도 없는 것처럼 보인다).
              -mx-5 -mb-8 은 창의 안쪽 여백(px-5 pb-8)을 되돌려 띠가 창 폭을 다 쓰게 한다.
            */}
            <div className="sticky bottom-0 z-[1] -mx-5 -mb-8 flex flex-col gap-2 bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_14px_-12px_rgba(0,0,0,0.2)]">
              {notice && (
                <p role="alert" className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
                  {notice}
                </p>
              )}
              <button
                type="button"
                onClick={() => void send()}
                className="rounded-full bg-accent px-5 py-3 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
              >
                {selected.length > 1 ? `${selected.length}곳에 엽서 만들기` : "엽서 만들기"}
              </button>
            </div>
          </>
        )}
      </div>
    </HubDialog>
  );
}
