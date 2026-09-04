"use client";

interface ViewToggleProps {
  value: "list" | "map";
  onChange: (value: "list" | "map") => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-2 md:hidden">
      {(["list", "map"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
          className={`rounded-full px-3 py-1 text-sm ${
            value === tab ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
          }`}
        >
          {tab === "list" ? "리스트" : "지도"}
        </button>
      ))}
    </div>
  );
}
