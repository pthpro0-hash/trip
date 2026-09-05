"use client";

import { useState } from "react";
import type { FilterCriteria } from "@/lib/filter";
import type { Region, Season, Theme } from "@/lib/types";

const REGIONS: Region[] = ["수도권", "강원권", "충청권", "전라권", "경상권", "제주권"];
const SEASONS: Season[] = ["봄", "여름", "가을", "겨울", "사계절"];
const THEMES: Theme[] = [
  "역사유적", "자연경관", "테마파크", "해변", "야경", "체험마을", "정원", "섬",
];

interface FilterBarProps {
  criteria: FilterCriteria;
  onChange: (criteria: FilterCriteria) => void;
}

function toggle<T>(list: T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export function FilterBar({ criteria, onChange }: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount =
    (criteria.regions?.length ?? 0) +
    (criteria.seasons?.length ?? 0) +
    (criteria.themes?.length ?? 0);

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-border-warm)] pb-4">
      <button
        type="button"
        className="flex items-center gap-1 self-start rounded-full border border-[var(--color-border-warm)] bg-parchment-light px-3 py-2 text-sm text-brown md:hidden"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {activeCount > 0 ? `필터 (${activeCount})` : "필터"} {expanded ? "▲" : "▾"}
      </button>
      <div className={`${expanded ? "flex" : "hidden"} flex-col gap-3 md:flex`}>
        <FilterGroup
          label="권역"
          options={REGIONS}
          selected={criteria.regions ?? []}
          onToggle={(v) => onChange({ ...criteria, regions: toggle(criteria.regions, v) })}
        />
        <FilterGroup
          label="계절"
          options={SEASONS}
          selected={criteria.seasons ?? []}
          onToggle={(v) => onChange({ ...criteria, seasons: toggle(criteria.seasons, v) })}
        />
        <FilterGroup
          label="테마"
          options={THEMES}
          selected={criteria.themes ?? []}
          onToggle={(v) => onChange({ ...criteria, themes: toggle(criteria.themes, v) })}
        />
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-sm font-medium text-brown-light">{label}</span>
      {options.map((option) => (
        <label
          key={option}
          className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${
            selected.includes(option)
              ? "border-gold bg-gold text-brown"
              : "border-[var(--color-border-warm)] bg-parchment-light text-brown"
          }`}
        >
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(option)}
            onChange={() => onToggle(option)}
            aria-label={option}
          />
          {option}
        </label>
      ))}
    </div>
  );
}
