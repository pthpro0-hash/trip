import type { Metadata } from "next";
import Link from "next/link";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";
import { regionStats } from "@/lib/regionStats";
import { RegionMiniMap } from "@/components/region/RegionMiniMap";

const SPOTS = spotsData as Spot[];

export const metadata: Metadata = {
  title: "권역별로 둘러보기",
  description: "수도권부터 제주권까지, 권역별 지도 위에서 한국관광 100선을 살펴보세요.",
};

export default function RegionsIndexPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">
        권역별로 둘러보기
      </h1>
      <p className="-mt-2 text-[15px] text-text-muted">
        권역을 선택하면 그 지역 여행지를 지도 위에 이름과 함께 표시해 드려요.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {REGIONS.map((region) => {
          const theme = REGION_THEME[region];
          const spots = SPOTS.filter((s) => s.region === region);
          const stats = regionStats(spots);
          return (
            <Link
              key={region}
              href={`/regions/${region}`}
              className="flex flex-col gap-2 rounded-2xl bg-bg-subtle p-2 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
            >
              <RegionMiniMap spots={spots} accent={theme.accent} />
              <div className="flex flex-col gap-0.5 px-1 pb-1 text-center">
                <span className="text-[15px] font-semibold tracking-tight text-text">{region}</span>
                <span className="text-[12px] text-text-faint">{spots.length}곳</span>
                <span className="mt-0.5 text-[12px] leading-snug text-text-muted">
                  {theme.tagline}
                </span>
                {/* 권역마다 무엇이 많은지 한 마디로 — 고를 근거가 된다. */}
                {stats.themes.length > 0 && (
                  <span className="mt-1 flex flex-wrap justify-center gap-1">
                    {stats.themes.slice(0, 2).map((item) => (
                      <span
                        key={item.value}
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: `${theme.accent}1F`, color: theme.accentDark }}
                      >
                        {item.value} {item.count}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
