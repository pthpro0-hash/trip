import type { Spot, Theme } from "./types";

export type SpotCategory = "자연" | "역사·문화" | "체험·도시" | "기타";

// Eight themes are too many for a map legend to stay readable, so they're
// folded into buckets. Colors are the dark end of each hue on purpose: the
// pin carries white numbering, and these all clear 4.5:1 against white.
export const CATEGORY_COLOR: Record<SpotCategory, string> = {
  자연: "#237032",
  "역사·문화": "#A66418",
  "체험·도시": "#BF4A0A",
  기타: "#5B6672",
};

export const SPOT_CATEGORIES: SpotCategory[] = ["자연", "역사·문화", "체험·도시", "기타"];

const HISTORY_THEMES: Theme[] = ["역사유적", "체험마을"];
const URBAN_THEMES: Theme[] = ["테마파크", "야경"];

// parse-md.ts derives themes from keyword rules, and about a sixth of the
// spots match none of them (강·호수·거리·기념관 …). Those get their own neutral
// bucket rather than being folded into whichever category is closest —
// guessing there would mislabel real places on a map people read as factual.
export function categorize(spot: Spot): SpotCategory {
  if (spot.themes.some((t) => HISTORY_THEMES.includes(t))) return "역사·문화";
  if (spot.themes.some((t) => URBAN_THEMES.includes(t))) return "체험·도시";
  if (spot.themes.length > 0) return "자연";
  return "기타";
}
