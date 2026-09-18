"use client";

interface ViewToggleProps {
  value: "list" | "map";
  onChange: (value: "list" | "map") => void;
}

// Segmented control: one track, the selected half lifted onto a white pill —
// the iOS pattern, which reads as a switch between two views rather than two
// separate buttons.
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 rounded-xl bg-bg-subtle p-1 md:hidden">
      {(["list", "map"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
          className={`flex-1 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition ${
            value === tab
              ? "bg-surface text-text shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              : "text-text-muted"
          }`}
        >
          {tab === "list" ? "리스트" : "지도"}
        </button>
      ))}
    </div>
  );
}
