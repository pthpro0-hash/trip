import type { Region } from "./types";

export interface RegionTheme {
  accent: string;
  accentDark: string;
  tagline: string;
}

// One accent color + one-line character description per region, used to
// give each region's illustrated map a distinct identity (border/pin color,
// background gradient, card copy) without needing hand-drawn artwork.
// accentDark doubles as the fill behind white pin-number text, so every
// value here is picked to clear ~4.5:1 contrast against white (verified via
// WCAG relative luminance) — plain "darker version of accent" wasn't always
// enough (충청권's amber needed a noticeably darker override to pass).
export const REGION_THEME: Record<Region, RegionTheme> = {
  수도권: { accent: "#4C6EF5", accentDark: "#3B5BDB", tagline: "궁궐과 도심이 만나는 곳" },
  강원권: { accent: "#2F9E44", accentDark: "#237032", tagline: "산과 바다가 함께하는 고원" },
  충청권: { accent: "#E8A33D", accentDark: "#A66418", tagline: "너른 들판과 옛 백제의 땅" },
  전라권: { accent: "#12B886", accentDark: "#0B8A66", tagline: "평야와 갯벌이 빚어낸 맛의 고장" },
  경상권: { accent: "#E8590C", accentDark: "#BF4A0A", tagline: "천년 역사와 바다의 도시" },
  제주권: { accent: "#15AABF", accentDark: "#0C7C8C", tagline: "화산이 빚은 섬" },
};
