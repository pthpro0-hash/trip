"use client";

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <div className="relative">
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="관광지 이름, 음식으로 검색"
        aria-label="검색"
        className="w-full rounded-xl bg-bg-subtle py-3 pl-10 pr-4 text-[15px] text-text placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
    </div>
  );
}
