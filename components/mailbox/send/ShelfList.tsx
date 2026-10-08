"use client";

import { useId, useState } from "react";
import { attachParticle } from "@/lib/korean";
import { BODY_MAX, suggestionsFor, type GreetingRow } from "@/lib/mailbox";
import type { MailboxItem } from "@/lib/supabase/mailbox";

/*
  받는 곳과 인사말.

  책장이 하나뿐인 대부분의 경우에 "받을 책장" 목록과 책장마다의 인사말 칸(자동으로 채웠어요 · 원래대로 · 추천 문구)은
  군더더기다. 접어 둔다 — 책장이 하나면 "인사말 고치기", 둘 이상이면 "받는 곳 바꾸기". 펼치면 책장마다 체크 · 인사말 ·
  추천 문구가 있다(인사말은 한 번 쓰면 다른 책장에 복사되고 호칭만 책장 것으로 바뀐다).
*/

interface ShelfListProps {
  /** 열린 책장들(닫은 책장에는 보낼 수 없다). */
  boxes: MailboxItem[];
  selectedIds: Set<string>;
  /** 고른 책장마다의 인사말(복사 후 수정). */
  rows: GreetingRow[];
  onToggle: (id: string) => void;
  /** 이 책장의 인사말을 직접 고쳤다. */
  onEdit: (id: string, text: string) => void;
  /** 직접 고친 것을 버리고 위의 글을 따라가게 한다. */
  onReset: (id: string) => void;
  /** 추천 문구를 이 책장 인사말에 덧붙인다. current 는 지금 인사말. */
  onSuggest: (id: string, suggestion: string, current: string) => void;
}

/** 따옴표로 감싼 이름 뒤에 붙는 ‘이/가’ — 따옴표 앞의 이름 받침으로 고른다. */
const subjectParticle = (name: string) => attachParticle(name, "이", "가").slice(name.length);

export function ShelfList({ boxes, selectedIds, rows, onToggle, onEdit, onReset, onSuggest }: ShelfListProps) {
  const [open, setOpen] = useState(false);
  const panel = useId();
  const many = boxes.length > 1;
  const rowOf = (id: string) => rows.find((row) => row.mailboxId === id);
  const names = boxes.filter((box) => selectedIds.has(box.id)).map((box) => box.name);

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-[14px] text-text-muted">
          <span className="font-medium text-text">{many ? "받는 곳" : "인사말"}</span>
          {many && names.length > 0 && (
            <>
              {/* 눈에 보이는 간격은 ml 이 주고, 낭독기가 한 덩이로 읽지 않게 글자 공백도 둔다. */}{" "}
              <span className="ml-1 break-keep">{names.join(", ")}</span>
            </>
          )}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panel : undefined}
          aria-label={open ? (many ? "받는 곳 접기" : "인사말 접기") : many ? "받는 곳 바꾸기" : "인사말 고치기"}
          onClick={() => setOpen(!open)}
          className="shrink-0 text-[13px] font-medium text-accent transition hover:text-accent-hover"
        >
          {open ? "접기" : many ? "바꾸기" : "고치기"}{" "}
          <span aria-hidden="true" className="text-[11px]">
            {open ? "▴" : "▾"}
          </span>
        </button>
      </div>

      {open && (
        <div id={panel} className="flex flex-col gap-2.5">
          {boxes.map((box) => {
            const row = rowOf(box.id);
            return (
              <div key={box.id} role="group" aria-label={box.name} className="flex flex-col gap-2 rounded-xl bg-bg p-3 ring-1 ring-line">
                <label className="flex items-center gap-2.5">
                  {many && (
                    <input type="checkbox" checked={selectedIds.has(box.id)} onChange={() => onToggle(box.id)} className="h-4 w-4" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{box.name}</span>
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                    {box.tone === "polite" ? "존댓말" : "편하게"}
                  </span>
                </label>
                {row && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-text-faint">
                        {box.useGreeting && box.greetingName
                          ? `앞에 ‘${box.greetingName}’${subjectParticle(box.greetingName)} 붙어요`
                          : "호칭 없이 보내요"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          row.edited ? "bg-[#faeeda] text-[#633806]" : "bg-[#e1f5ee] text-[#085041]"
                        }`}
                      >
                        {row.edited ? "직접 고쳤어요" : "자동으로 채웠어요"}
                      </span>
                      {row.edited && (
                        <button type="button" onClick={() => onReset(box.id)} className="text-[12px] font-medium text-accent">
                          원래대로
                        </button>
                      )}
                    </div>
                    <textarea
                      value={row.body}
                      rows={2}
                      maxLength={BODY_MAX}
                      aria-label={`${box.name} 인사말`}
                      onChange={(event) => onEdit(box.id, event.target.value)}
                      className="resize-y rounded-lg bg-bg-subtle px-3 py-2 text-[14px] leading-relaxed text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12px] text-text-faint">추천</span>
                      {suggestionsFor(box.tone).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => onSuggest(box.id, suggestion, row.body || "")}
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
        </div>
      )}
    </section>
  );
}
