"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CORE_CHAPTERS } from "@/lib/help";

/*
  처음 온 사람에게 내미는 한 장.

  이 서비스는 첫 화면만 봐서는 무엇을 해 주는지 알기 어렵다. 100선
  목록은 흔하고, 정작 다른 데서 못 하는 일 — 사진만 고르면 다녀온 길이
  그림이 되는 것 — 은 안쪽에 있다. 그래서 한 번은 말로 해 준다.

  갈래를 한 번에 하나씩만 보여 준다. 두 갈래를 나란히 늘어놓으면 글이
  많아 보여서 읽기 전에 닫는다.
*/

interface HelpDialogProps {
  onClose: () => void;
}

export function HelpDialog({ onClose }: HelpDialogProps) {
  const [page, setPage] = useState(0);
  const chapter = CORE_CHAPTERS[page];
  const last = page === CORE_CHAPTERS.length - 1;

  /* 읽는 동안 뒤가 따라 움직이면 어지럽다. */
  useEffect(() => {
    const kept = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = kept;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="사용법 안내"
        /* 안쪽을 누른 것까지 닫힘으로 세지 않는다. */
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-line"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <p className="text-[13px] font-medium text-text-faint">
              {page + 1} / {CORE_CHAPTERS.length}
            </p>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-text">
              <span aria-hidden="true">{chapter.icon}</span> {chapter.title}
            </h2>
            <p className="mt-1 text-[15px] leading-relaxed text-text-muted">{chapter.blurb}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="안내 닫기"
            className="-mr-2 -mt-2 shrink-0 rounded-full px-3 py-2 text-[18px] text-text-faint transition hover:bg-bg-subtle hover:text-text"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <ol className="mt-4 flex flex-col gap-3.5 overflow-y-auto px-6 pb-4">
          {chapter.steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-text">{step.title}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
          <Link
            href={chapter.href}
            onClick={onClose}
            className="rounded-full bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition hover:bg-accent-hover"
          >
            {chapter.hrefLabel}
          </Link>

          {last ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-bg-subtle px-4 py-2.5 text-[14px] font-medium text-text transition hover:bg-line"
            >
              둘러볼게요
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              className="rounded-full bg-bg-subtle px-4 py-2.5 text-[14px] font-medium text-text transition hover:bg-line"
            >
              다음: {CORE_CHAPTERS[page + 1].title}
            </button>
          )}

          <Link
            href="/help"
            onClick={onClose}
            className="ml-auto text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            도움말 전체 보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
