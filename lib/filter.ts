import type { Spot, Region, Season, Theme } from "./types";

export interface FilterCriteria {
  regions?: Region[];
  seasons?: Season[];
  themes?: Theme[];
  query?: string;
}

function buildSearchableText(spot: Spot): string {
  return [spot.name, spot.summary, spot.highlights.join(" "), spot.foods.join(" ")]
    .join(" ")
    .toLowerCase();
}

export function filterSpots(spots: Spot[], criteria: FilterCriteria): Spot[] {
  return spots.filter((spot) => {
    if (criteria.regions?.length && !criteria.regions.includes(spot.region)) return false;
    if (criteria.seasons?.length && !spot.seasons.some((s) => criteria.seasons!.includes(s))) {
      return false;
    }
    if (criteria.themes?.length && !spot.themes.some((t) => criteria.themes!.includes(t))) {
      return false;
    }
    const query = criteria.query?.trim();
    if (query && !buildSearchableText(spot).includes(query.toLowerCase())) {
      return false;
    }
    return true;
  });
}

export interface RelaxationSuggestion {
  relaxed: "regions" | "seasons" | "themes" | "query";
  count: number;
}

export function suggestRelaxedFilters(
  spots: Spot[],
  criteria: FilterCriteria,
): RelaxationSuggestion[] {
  const keys: RelaxationSuggestion["relaxed"][] = ["regions", "seasons", "themes", "query"];
  const suggestions: RelaxationSuggestion[] = [];

  for (const key of keys) {
    if (!criteria[key]?.length) continue;
    const relaxed: FilterCriteria = { ...criteria, [key]: undefined };
    const count = filterSpots(spots, relaxed).length;
    if (count > 0) suggestions.push({ relaxed: key, count });
  }

  return suggestions.sort((a, b) => a.count - b.count);
}
