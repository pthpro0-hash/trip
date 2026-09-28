"use client";

import { useRef, useState } from "react";
import { companionLabel } from "@/lib/korean";

/*
  누구와 갔는지 — 나중에 채우기.

  비어 있으면 "+ 누구와 갔는지 적기"를 내민다. 누르면 칸이 열리고, 전에
  적은 이름들이 단추로 뜬다. 단추를 누르면 곧바로 적힌다 — 대부분은 늘
  같은 사람과 다니므로 치는 일 없이 한 번에 끝나야 한다.

  칸에 직접 쓸 때는 제목과 같은 규칙이다: Enter 나 손을 떼면 저장,
  Esc 는 버리기, 비우면 지우기.
*/

interface CompanionEditorProps {
  value: string | null;
  suggestions: string[];
  onSave: (next: string) => Promise<boolean>;
}

export function CompanionEditor({ value, suggestions, onSave }: CompanionEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  /** Esc 로 버리는 중이면 손을 뗄 때 저장하지 않는다. 단추로 고른 때도. */
  const skipBlur = useRef(false);

  const open = () => {
    setDraft(value ?? "");
    setFailed(false);
    setSaved(false);
    setEditing(true);
  };

  const commit = async (next: string) => {
    setEditing(false);
    if (next.trim() === (value ?? "").trim()) return;
    const ok = await onSave(next);
    setFailed(!ok);
    setSaved(ok);
  };

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5">
        {value ? (
          <button
            type="button"
            onClick={open}
            aria-label={`누구와: ${value} — 고치기`}
            className="rounded-md px-1 text-text-faint underline-offset-2 hover:bg-bg-subtle hover:text-text hover:underline"
          >
            {companionLabel(value)} ✎
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            className="rounded-md px-1 font-medium text-accent hover:bg-accent-soft"
          >
            + 누구와 갔는지 적기
          </button>
        )}
        {saved && <span>· 적어 뒀어요</span>}
        {failed && <span className="text-text-muted">· 적지 못했어요. 다시 해 주세요.</span>}
      </span>
    );
  }

  return (
    <span className="mt-2 flex w-full flex-col gap-2">
      <input
        type="text"
        autoFocus
        value={draft}
        aria-label="누구와 갔나요"
        placeholder="예: 가족, 민수, 혼자"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          void commit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            skipBlur.current = true;
            setEditing(false);
          }
        }}
        className="w-full rounded-xl bg-bg-subtle px-3.5 py-2.5 text-[15px] text-text outline-none ring-1 ring-line focus:ring-2 focus:ring-accent"
      />
      {suggestions.length > 0 && (
        <span className="flex flex-wrap gap-1.5" aria-label="전에 적은 이름">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              // 칸의 blur 보다 먼저 와야 두 번 저장되지 않는다.
              onMouseDown={(event) => {
                event.preventDefault();
                skipBlur.current = true;
              }}
              onClick={() => {
                skipBlur.current = false;
                void commit(name);
              }}
              className="rounded-full bg-bg-subtle px-3 py-1.5 text-[14px] text-text ring-1 ring-line transition hover:bg-accent-soft hover:text-accent"
            >
              {name}
            </button>
          ))}
        </span>
      )}
      <span className="text-[12px] text-text-faint">
        누르면 바로 적혀요. 직접 쓰면 Enter 로 저장, Esc 로 취소, 비우면 지워요.
      </span>
    </span>
  );
}
