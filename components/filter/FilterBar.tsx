"use client";

import { useState } from "react";
import { ALL_SEASONS, ALL_THEMES, type FilterCriteria } from "@/lib/filter";
import { REGIONS } from "@/lib/regions";

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
    <div className="flex flex-col gap-3">
      {/*
        조건을 고를 수 있다는 것을 모르면 목록을 끝까지 내리며 눈으로
        찾는다. 무엇을 누르면 무엇이 되는지 한 줄로 알려 준다.
      */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          className="flex items-center gap-1 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text md:hidden"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {activeCount > 0 ? `필터 ${activeCount}` : "필터"} {expanded ? "▲" : "▾"}
        </button>
        <p className="text-[13px] text-text-faint">
          {activeCount > 0
            ? "조건을 다시 누르면 풀려요. 여러 개를 함께 걸 수 있어요."
            : "권역·계절·테마를 눌러 좁혀 보세요. 여러 개를 함께 걸 수 있어요."}
        </p>
      </div>
      <div className={`${expanded ? "flex" : "hidden"} flex-col gap-2.5 md:flex`}>
        <FilterGroup
          label="권역"
          options={REGIONS}
          selected={criteria.regions ?? []}
          onToggle={(v) => onChange({ ...criteria, regions: toggle(criteria.regions, v) })}
        />
        <FilterGroup
          label="계절"
          options={ALL_SEASONS}
          selected={criteria.seasons ?? []}
          onToggle={(v) => onChange({ ...criteria, seasons: toggle(criteria.seasons, v) })}
        />
        <FilterGroup
          label="테마"
          options={ALL_THEMES}
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
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-10 shrink-0 text-[13px] font-medium text-text-faint">{label}</span>
      {options.map((option) => (
        <label
          key={option}
          className={`cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
            selected.includes(option)
              ? "bg-accent text-on-accent"
              : "bg-bg-subtle text-text hover:bg-line"
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
