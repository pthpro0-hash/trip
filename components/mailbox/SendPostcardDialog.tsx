"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchMailboxes, type MailboxItem } from "@/lib/supabase/mailbox";
import { sendPostcard, type SendPostcardResult } from "@/lib/supabase/postcards";
import type { TripDetail } from "@/lib/supabase/tripDetail";
import {
  BODY_MAX,
  POSTCARD_PHOTOS,
  greetingsFor,
  pickPostcardPhotos,
  postcardUrl,
  suggestionsFor,
} from "@/lib/mailbox";
import { HubDialog } from "@/components/hub/HubDialog";
import { WaitingOverlay } from "@/components/layout/Waiting";

/*
  엽서 보내기 — 이 여행을 부모님 우편함으로.

  사진 3장(자동으로 골라 두고 바꿀 수 있다)과 한 줄을 쓰고, 받을 우편함을 고른다. 인사말은 우편함마다
  따로다 — 한 번 쓰면 다른 우편함에 복사되고 호칭만 그 우편함 것으로 바뀐다. 직접 고친 우편함은 따로 간다.
  보내면 엽서는 그 순간의 모습으로 남는다(사진은 한 번만 복사한다).

  보내기 단추는 폰의 공유창(카카오톡이 목록에 나온다)을 연다. 안 되는 브라우저에서는 링크 복사.
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
  invalid: "받을 우편함, 한 줄, 보내는 이름을 확인해 주세요.",
  photos: "사진을 옮기지 못했어요. 인터넷이 약한가 봐요. 잠시 뒤 다시 해 주세요. (엽서는 나가지 않았어요)",
  failed: "보내지 못했어요. 잠시 뒤 다시 해 주세요. (엽서는 나가지 않았어요)",
};

export function SendPostcardDialog({ userId, trip, photoUrls, onClose }: SendPostcardDialogProps) {
  const [boxes, setBoxes] = useState<MailboxItem[] | "loading" | "failed">("loading");
  const [senderName, setSenderName] = useState("");
  const [body, setBody] = useState("");
  const photos = useMemo(
    () => trip.visits.flatMap((visit) => visit.photos.map((photo) => ({ ...photo, visitId: visit.id }))),
    [trip],
  );
  const [picked, setPicked] = useState<string[]>(() => pickPostcardPhotos(photos).map((photo) => photo.id));
  const [checked, setChecked] = useState<Set<string> | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data.user?.user_metadata ?? {};
      const account = String(meta.full_name ?? meta.name ?? "").trim().split(/\s+/)[0] ?? "";
      if (active) setSenderName(remembered() || account);
      const list = await fetchMailboxes(supabase, userId);
      if (!active) return;
      if (list === "failed") return setBoxes("failed");
      // 닫은 우편함에는 보낼 수 없다.
      setBoxes([...list.owned, ...list.joined].filter((box) => !box.closed));
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const openBoxes = Array.isArray(boxes) ? boxes : [];
  // 처음에는 열린 우편함을 모두 고른 것으로 둔다. 하나뿐이면 더 쉽다.
  const selectedIds = checked ?? new Set(openBoxes.map((box) => box.id));
  const selected = openBoxes.filter((box) => selectedIds.has(box.id));
  const rows = greetingsFor(body, selected, overrides);
  const rowOf = (id: string) => rows.find((row) => row.mailboxId === id);

  const togglePhoto = (id: string) =>
    setPicked((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : current.length >= POSTCARD_PHOTOS
          ? current
          : [...current, id],
    );

  const toggleBox = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const canSend = body.trim().length > 0 && senderName.trim().length > 0 && selected.length > 0 && !working;

  const send = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !canSend) return;
    setFailure(null);
    setWorking({ done: 0, total: picked.length });
    const result = await sendPostcard(supabase, {
      senderId: userId,
      senderName,
      trip,
      photoIds: picked,
      deliveries: rows.map((row) => ({ mailboxId: row.mailboxId, greeting: row.text })),
      onProgress: (done, total) => setWorking({ done, total }),
    });
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

  const linkOf = (box: MailboxItem, postcardId: string) => postcardUrl(window.location.origin, box.token, postcardId);

  const share = async (box: MailboxItem, greeting: string) => {
    if (!sent) return;
    try {
      await navigator.share({
        title: `${sent.senderName}이(가) 보낸 여행 엽서`,
        text: greeting,
        url: linkOf(box, sent.postcardId),
      });
    } catch {
      // 공유 창을 닫은 것뿐이다.
    }
  };

  const copy = async (box: MailboxItem) => {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(linkOf(box, sent.postcardId));
      setNote(`${box.name} 링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.`);
    } catch {
      setNote(`복사하지 못했어요. 이 주소를 직접 복사해 주세요: ${linkOf(box, sent.postcardId)}`);
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <HubDialog label="엽서 보내기" onClose={onClose}>
      {working && (
        <WaitingOverlay
          title="엽서를 보내고 있어요"
          detail={working.total > 0 ? `사진 ${working.done}장 / ${working.total}장` : undefined}
          note="고른 사진을 엽서 보관함으로 옮기는 중이에요."
        />
      )}

      <div className="flex flex-col gap-5 pr-8">
        {sent ? (
          <>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-text">엽서를 만들었어요</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-text-muted">
                이제 받는 분께 링크를 보내 주세요. 링크를 열면 로그인 없이 엽서를 볼 수 있어요. 엽서는 지금 모습으로
                남고, 이 여행을 지우면 엽서도 함께 지워져요.
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {sent.boxes.map(({ box, greeting }) => (
                <li key={box.id} className="flex flex-col gap-2 rounded-xl bg-bg-subtle p-3.5">
                  <p className="text-[15px] font-semibold text-text">{box.name}</p>
                  <p className="text-[13px] leading-relaxed text-text-muted">&ldquo;{greeting}&rdquo;</p>
                  <div className="flex flex-wrap gap-2">
                    {canShare && (
                      <button
                        type="button"
                        onClick={() => void share(box, greeting)}
                        className="rounded-full bg-[#fee500] px-4 py-2 text-[14px] font-medium text-[#1d1d1f]"
                      >
                        카카오톡 등으로 보내기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void copy(box)}
                      className="rounded-full bg-bg px-4 py-2 text-[14px] font-medium text-text ring-1 ring-line hover:bg-line"
                    >
                      링크 복사
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {note && (
              <p role="status" className="break-all rounded-xl bg-bg-subtle px-4 py-3 text-[13px] text-text-muted">
                {note}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent hover:bg-accent-hover"
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-text">부모님께 엽서 보내기</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-text-muted">
                사진 몇 장과 한 줄을 골라 엽서로 보내요. 받는 분은 링크 하나로, 로그인 없이 열어 봐요.
              </p>
            </div>

            {boxes === "loading" && <p className="text-[14px] text-text-muted">우편함을 불러오는 중…</p>}
            {boxes === "failed" && <p className="text-[14px] text-text-muted">우편함을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>}
            {Array.isArray(boxes) && boxes.length === 0 && (
              <p className="rounded-xl bg-bg-subtle p-4 text-[14px] leading-relaxed text-text-muted">
                보낼 수 있는 우편함이 없어요.{" "}
                <Link href="/mailboxes" className="font-medium text-accent hover:text-accent-hover">
                  우편함을 만들어
                </Link>{" "}
                주세요.
              </p>
            )}

            {Array.isArray(boxes) && boxes.length > 0 && (
              <>
                <section className="flex flex-col gap-2">
                  <h3 className="text-[14px] font-semibold text-text">
                    사진 <span className="font-normal text-text-muted">{picked.length}/{POSTCARD_PHOTOS}</span>
                  </h3>
                  {photos.length === 0 ? (
                    <p className="text-[13px] text-text-faint">이 여행에는 사진이 없어요. 글과 지도만 가요.</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                      {photos.map((photo) => {
                        const on = picked.includes(photo.id);
                        const url = photoUrls.get(photo.storagePath);
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            aria-pressed={on}
                            aria-label={on ? "엽서에서 빼기" : "엽서에 넣기"}
                            onClick={() => togglePhoto(photo.id)}
                            disabled={!on && picked.length >= POSTCARD_PHOTOS}
                            className={`relative aspect-square overflow-hidden rounded-lg bg-bg-subtle ring-2 transition disabled:opacity-40 ${
                              on ? "ring-accent" : "ring-transparent"
                            }`}
                          >
                            {url && (
                              // eslint-disable-next-line @next/next/no-img-element -- 서명 주소는 그때그때 바뀐다
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            )}
                            {on && (
                              <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-on-accent">
                                {picked.indexOf(photo.id) + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[14px] font-semibold text-text">한 줄</span>
                    <textarea
                      value={body}
                      maxLength={BODY_MAX}
                      rows={3}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder="강릉 바다 보고 왔어요. 다음엔 같이 가요!"
                      className="resize-y rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] leading-relaxed text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-text-muted">
                    보내는 이름
                    <input
                      type="text"
                      value={senderName}
                      maxLength={20}
                      onChange={(event) => setSenderName(event.target.value)}
                      aria-label="보내는 이름"
                      className="w-28 rounded-lg bg-bg-subtle px-2.5 py-1.5 text-[14px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                    />
                    <span className="text-text-faint">받는 분께 &lsquo;○○이 보낸 엽서&rsquo;로 보여요</span>
                  </label>
                </section>

                <section className="flex flex-col gap-2.5">
                  <h3 className="text-[14px] font-semibold text-text">받을 우편함</h3>
                  {openBoxes.map((box) => {
                    const row = rowOf(box.id);
                    return (
                      <div key={box.id} className="flex flex-col gap-2 rounded-xl bg-bg p-3 ring-1 ring-line">
                        <label className="flex items-center gap-2.5">
                          <input type="checkbox" checked={selectedIds.has(box.id)} onChange={() => toggleBox(box.id)} className="h-4 w-4" />
                          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{box.name}</span>
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">{box.tone === "polite" ? "존댓말" : "편하게"}</span>
                        </label>
                        {row && (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-text-faint">
                                {box.useGreeting && box.greetingName ? `앞에 ‘${box.greetingName}’ 이 붙어요` : "호칭 없이 보내요"}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] ${
                                  row.edited ? "bg-[#faeeda] text-[#633806]" : "bg-[#e1f5ee] text-[#085041]"
                                }`}
                              >
                                {row.edited ? "직접 고쳤어요" : "자동으로 채웠어요"}
                              </span>
                              {row.edited && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOverrides((current) => {
                                      const next = { ...current };
                                      delete next[box.id];
                                      return next;
                                    })
                                  }
                                  className="text-[12px] font-medium text-accent"
                                >
                                  원래대로
                                </button>
                              )}
                            </div>
                            <textarea
                              value={row.body}
                              rows={2}
                              maxLength={BODY_MAX}
                              aria-label={`${box.name} 인사말`}
                              onChange={(event) => setOverrides((current) => ({ ...current, [box.id]: event.target.value }))}
                              className="resize-y rounded-lg bg-bg-subtle px-3 py-2 text-[14px] leading-relaxed text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                            />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[12px] text-text-faint">추천</span>
                              {suggestionsFor(box.tone).map((suggestion) => (
                                <button
                                  key={suggestion}
                                  type="button"
                                  onClick={() =>
                                    setOverrides((current) => ({
                                      ...current,
                                      [box.id]: `${(row.body || "").trim()} ${suggestion}`.trim(),
                                    }))
                                  }
                                  className="rounded-full bg-bg-subtle px-2.5 py-1 text-[12px] text-text hover:bg-line"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                            {row.text && (
                              <p className="text-[12px] leading-relaxed text-text-muted">
                                받는 분께 보이는 글: <span className="text-text">&ldquo;{row.text}&rdquo;</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>

                {failure && (
                  <p role="alert" className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
                    {failure}
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!canSend}
                    className="rounded-full bg-accent px-5 py-3 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
                  >
                    {selected.length > 1 ? `${selected.length}곳에 엽서 보내기` : "엽서 보내기"}
                  </button>
                  <p className="text-[12px] text-text-faint">
                    엽서는 보낸 순간 그대로 남아요. 이 여행이나 사진을 지우면 엽서에서도 사라져요.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </HubDialog>
  );
}
