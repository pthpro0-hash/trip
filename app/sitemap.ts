import type { MetadataRoute } from "next";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";

const SPOTS = spotsData as Spot[];
export const BASE_URL = "https://yeohaeng-sesang.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/regions`, changeFrequency: "monthly", priority: 0.8 },
    ...REGIONS.map((region) => ({
      url: `${BASE_URL}/regions/${encodeURIComponent(region)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...SPOTS.map((spot) => ({
      url: `${BASE_URL}/spots/${encodeURIComponent(spot.id)}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
