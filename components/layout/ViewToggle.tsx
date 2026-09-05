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
          className={`rounded-full border px-3 py-2 text-sm ${
            value === tab
              ? "border-brown bg-brown text-white"
              : "border-[var(--color-border-warm)] bg-parchment-light text-brown"
          }`}
        >
          {tab === "list" ? "리스트" : "지도"}
        </button>
      ))}
    </div>
  );
}
