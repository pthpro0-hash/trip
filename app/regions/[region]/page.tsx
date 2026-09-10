import Link from "next/link";
import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Region, Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";
import { RegionMap } from "@/components/region/RegionMap";

const SPOTS = spotsData as Spot[];

export function generateStaticParams() {
  return REGIONS.map((region) => ({ region }));
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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/regions" className="text-sm text-text-muted hover:text-text">
        ← 권역별로 둘러보기
      </Link>
      <div>
        <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">{region}</h1>
        <p className="text-sm text-text-muted">
          {theme.tagline} · {spots.length}곳
        </p>
      </div>

      <RegionMap region={region} spots={spots} />
    </main>
  );
}
