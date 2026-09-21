import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Region, Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";
import { splitRegionIntoClusters } from "@/lib/regionClusters";
import { RegionMap } from "@/components/region/RegionMap";

const SPOTS = spotsData as Spot[];

export function generateStaticParams() {
  return REGIONS.map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region: raw } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return { title: "권역" };
  }
  if (!REGIONS.includes(decoded as Region)) return { title: "권역" };

  const region = decoded as Region;
  const count = SPOTS.filter((s) => s.region === region).length;
  return {
    title: `${region} 여행지 ${count}곳`,
    description: `${REGION_THEME[region].tagline}. ${region}의 한국관광 100선 ${count}곳을 지도에서 확인하세요.`,
    alternates: { canonical: `/regions/${region}` },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: rawRegion } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawRegion);
  } catch {
    notFound();
  }
  if (!REGIONS.includes(decoded as Region)) notFound();
  const region = decoded as Region;

  const theme = REGION_THEME[region];
  const spots = SPOTS.filter((s) => s.region === region);
  // Regions with a lot of spots read as one crowded blob on a single card,
  // so past a threshold they're split into geographically contiguous
  // sub-maps (see lib/regionClusters.ts) rather than one dense map.
  const clusters = splitRegionIntoClusters(spots);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-5 pb-16 pt-8">
      <div className="flex flex-col gap-4">
        <Link href="/regions" className="text-[15px] font-medium text-accent hover:text-accent-hover">
          ← 권역별로 둘러보기
        </Link>
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">{region}</h1>
          <p className="mt-1 text-[15px] text-text-muted">
            {theme.tagline} · {spots.length}곳
            {clusters.length > 1 ? ` · ${clusters.length}개 지도로 나눠 표시` : ""}
          </p>
        </div>
      </div>

      {clusters.map((cluster) => (
        <RegionMap
          key={cluster.label || region}
          region={region}
          spots={cluster.spots}
          label={cluster.label}
        />
      ))}
    </main>
  );
}
