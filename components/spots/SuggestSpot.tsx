"use client";

import { useState } from "react";
import Link from "next/link";
import { HubDialog } from "@/components/hub/HubDialog";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  NAME_MAX,
  PENDING_MAX,
  PLACE_MAX,
  REASON_MAX,
  STATUS_LABEL,
  fetchMySuggestions,
  removeSuggestion,
  submitSuggestion,
  type Suggestion,
} from "@/lib/supabase/spotSuggestions";

/*
  빠진 곳 추천하기 — "이 곳이 목록에 있으면 좋겠어요". 보내면 관리자가 보고 반영 여부를 정한다. 목록에 넣는 일은 개발로 하니, 보낸 사람에게
  약속하는 것은 "검토한다"까지다. 로그인한 사람만 보낼 수 있다(장난 글을 줄이려고). 보낸 것과 처리 결과는 같은 창에서 본다.
*/
export function SuggestSpot({ label = "빠진 곳이 있나요? 추천하기" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mine, setMine] = useState<Suggestion[] | null>(null);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const supabase = getBrowserClient();
    if (!supabase) {
      setReady(true);
      return;
    }
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      setUserId(id);
      if (id) setMine(await fetchMySuggestions(supabase, id));
    } catch {
      // 알아보지 못했다. 로그인 길을 내민다.
    }
    setReady(true);
  };

  const show = () => {
    setOpen(true);
    setNotice(null);
    void load();
  };

  const pending = (mine ?? []).filter((item) => item.status === "new").length;

  const send = async () => {
    const supabase = getBrowserClient();
    if (!supabase || !userId || busy) return;
    setBusy(true);
    setNotice(null);
    const result = await submitSuggestion(supabase, userId, { name, place, reason });
    if (result === "ok") {
      setName("");
      setPlace("");
      setReason("");
      setNotice("보냈어요. 검토해서 반영 여부를 알려 드릴게요.");
      setMine(await fetchMySuggestions(supabase, userId));
    } else if (result === "limit") {
      setNotice(`검토 중인 추천이 ${PENDING_MAX}건이에요. 결과가 나온 뒤에 더 보내 주세요.`);
    } else if (result === "invalid") {
      setNotice("곳 이름을 적어 주세요.");
    } else {
      setNotice("보내지 못했어요. 잠시 뒤 다시 해 주세요.");
    }
    setBusy(false);
  };

  const withdraw = async (id: string) => {
    const supabase = getBrowserClient();
    if (!supabase || !userId) return;
    if (await removeSuggestion(supabase, id)) setMine(await fetchMySuggestions(supabase, userId));
  };

  const loginHref = `/login?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`;

  return (
    <>
      <button
        type="button"
        onClick={show}
        className="rounded-full bg-bg-subtle px-4 py-2 text-[13px] font-medium text-text-muted transition hover:bg-line hover:text-text"
      >
        {label}
      </button>

      {open && (
        <HubDialog label="빠진 곳 추천하기" onClose={() => setOpen(false)} locked={busy}>
          <div className="flex flex-col gap-4 overflow-y-auto p-5 pt-6">
            <h2 className="pr-9 text-[18px] font-bold tracking-tight text-text">빠진 곳 추천하기</h2>

            {!ready ? (
              <p className="text-[14px] text-text-muted">불러오는 중이에요…</p>
            ) : !userId ? (
              <p className="break-keep text-[14px] leading-relaxed text-text-muted">
                추천은 로그인한 분만 보낼 수 있어요.{" "}
                <Link href={loginHref} className="font-medium text-accent">
                  로그인하기
                </Link>
              </p>
            ) : (
              <>
                <p className="break-keep text-[13px] leading-relaxed text-text-muted">
                  목록에 있으면 좋겠다 싶은 곳을 알려 주세요. 보내 주신 곳은 검토해서 반영할지 정하고, 결과는 여기서 알려 드려요.
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-faint">곳 이름</span>
                  <input
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(event) => setName(event.target.value)}
                    className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-faint">어디쯤인가요? (선택)</span>
                  <input
                    value={place}
                    maxLength={PLACE_MAX}
                    placeholder="예: 강릉시 안목해변"
                    onChange={(event) => setPlace(event.target.value)}
                    className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-faint">추천하는 이유 (선택)</span>
                  <textarea
                    value={reason}
                    maxLength={REASON_MAX}
                    rows={3}
                    onChange={(event) => setReason(event.target.value)}
                    className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                  />
                </label>
                {notice && (
                  <p role="status" className="break-keep text-[13px] text-text-muted">
                    {notice}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={busy || name.trim() === "" || pending >= PENDING_MAX}
                  className="rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60"
                >
                  {busy ? "보내는 중…" : "추천 보내기"}
                </button>

                {mine && mine.length > 0 && (
                  <section aria-label="내가 보낸 추천" className="flex flex-col gap-2 border-t border-line pt-4">
                    <h3 className="text-[13px] font-semibold text-text-muted">내가 보낸 추천</h3>
                    <ul className="flex flex-col gap-2">
                      {mine.map((item) => (
                        <li key={item.id} className="rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[14px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium text-text">{item.name}</span>
                            <span className="shrink-0 text-[12px] text-text-faint">{STATUS_LABEL[item.status]}</span>
                          </div>
                          {item.adminNote && <p className="mt-1 break-keep text-[13px] text-text-muted">{item.adminNote}</p>}
                          {item.status === "new" && (
                            <button
                              type="button"
                              onClick={() => void withdraw(item.id)}
                              className="mt-1 text-[12px] text-text-faint underline underline-offset-2"
                            >
                              거두기
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>
        </HubDialog>
      )}
    </>
  );
}
