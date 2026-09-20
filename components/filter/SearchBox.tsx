"use client";

import { useEffect, useRef, useState } from "react";
import type { Spot } from "@/lib/types";
import { SEARCH_SUGGESTIONS, suggestCompletions } from "@/lib/search";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  spots: Spot[];
}

// Typing re-filters 121 spots and rebuilds every map marker, so the parent only
// hears about a change once typing pauses. The field itself stays instant by
// holding its own value.
const DEBOUNCE_MS = 180;

export function SearchBox({ value, onChange, spots }: SearchBoxProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep in step when the value changes from outside (a reset, or a chip on
  // another component) without fighting the user's own typing. Adjusting during
  // render is React's sanctioned way to derive state from a changed prop.
  const [lastExternalValue, setLastExternalValue] = useState(value);
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const completions = draft.trim() ? suggestCompletions(spots, draft, 5) : [];
  const showCompletions = focused && completions.length > 0;
  const showChips = focused && !draft.trim();

  function commit(next: string) {
    setDraft(next);
    onChange(next);
    setFocused(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-text-faint"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setFocused(false);
          if (e.key === "Enter") {
            onChange(draft);
            setFocused(false);
          }
        }}
        placeholder="이름, 지역, 테마로 검색 (예: 제주 해변)"
        aria-label="검색"
        className="w-full rounded-xl bg-bg-subtle py-3 pl-10 pr-10 text-[15px] text-text placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
      {draft && (
        <button
          type="button"
          onClick={() => commit("")}
          aria-label="검색어 지우기"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-faint hover:text-text"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3 10.2L12.2 13 10 10.8 7.8 13 7 12.2 9.2 10 7 7.8 7.8 7 10 9.2 12.2 7l.8.8L10.8 10l2.2 2.2z" />
          </svg>
        </button>
      )}

      {showChips && (
        <div className="absolute z-20 mt-2 flex w-full flex-wrap gap-1.5 rounded-xl bg-surface p-3 shadow-[0_8px_28px_rgba(0,0,0,0.12)] ring-1 ring-line">
          <span className="w-full pb-1 text-[12px] text-text-faint">이런 걸 찾아보세요</span>
          {SEARCH_SUGGESTIONS.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => commit(term)}
              className="rounded-full bg-bg-subtle px-3 py-1.5 text-[13px] font-medium text-text hover:bg-line"
            >
              {term}
            </button>
          ))}
        </div>
      )}

      {showCompletions && (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl bg-surface py-1 shadow-[0_8px_28px_rgba(0,0,0,0.12)] ring-1 ring-line">
          {completions.map((spot) => (
            <li key={spot.id}>
              <button
                type="button"
                onClick={() => commit(spot.name)}
                className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left hover:bg-bg-subtle"
              >
                <span className="truncate text-[15px] text-text">{spot.name}</span>
                <span className="shrink-0 text-[12px] text-text-faint">{spot.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
