import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Region, Spot } from "@/lib/types";
import { REGIONS, adjacentRegions } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";
import { RegionExplorer } from "@/components/region/RegionExplorer";

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
  const { prev, next } = adjacentRegions(region);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-16 pt-8">
      <div className="flex flex-col gap-4">
        <Link href="/regions" className="text-[15px] font-medium text-accent hover:text-accent-hover">
          ← 권역별로 둘러보기
        </Link>
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">{region}</h1>
          <p className="mt-1 text-[15px] text-text-muted">
            {theme.tagline} · {spots.length}곳
          </p>
        </div>
      </div>

      <RegionExplorer region={region} spots={spots} />

      {/* 한 권역을 다 본 사람이 목록으로 되돌아가지 않고 옆으로 넘어갈 수 있게. */}
      <nav className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-5">
        <Link
          href={`/regions/${prev}`}
          className="flex min-w-0 flex-col items-start gap-0.5 text-left"
        >
          <span className="text-[12px] text-text-faint">이전 권역</span>
          <span className="truncate text-[15px] font-medium text-accent hover:text-accent-hover">
            ← {prev}
          </span>
        </Link>
        <Link
          href={`/regions/${next}`}
          className="flex min-w-0 flex-col items-end gap-0.5 text-right"
        >
          <span className="text-[12px] text-text-faint">다음 권역</span>
          <span className="truncate text-[15px] font-medium text-accent hover:text-accent-hover">
            {next} →
          </span>
        </Link>
      </nav>
    </main>
  );
}
