import type { MetadataRoute } from "next";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";

const SPOTS = spotsData as Spot[];
export const BASE_URL = "https://yeohaeng-sesang.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: "weekly", priority: 1 },
    // 사진으로 남기는 내 여행이 어떤 것인지 결과로 보여 주는 예시. 로그인 없이 볼 수 있다.
    { url: `${BASE_URL}/example`, changeFrequency: "monthly", priority: 0.7 },
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
    // 약관과 방침은 찾을 수 있어야 하는 문서다. 자주 바뀌지 않으니 낮게 둔다.
    { url: `${BASE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
