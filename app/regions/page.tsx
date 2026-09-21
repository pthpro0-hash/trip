import type { Metadata } from "next";
import Link from "next/link";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";
import { KOREA_FULL_VIEWBOX, KOREA_LAND_PATHS, project } from "@/lib/koreaMap";

const SPOTS = spotsData as Spot[];

export const metadata: Metadata = {
  title: "권역별로 둘러보기",
  description: "수도권부터 제주권까지, 권역별 지도 위에서 한국관광 100선을 살펴보세요.",
};
const SEA = "#CFE4EE";
const LAND = "#F6F3E9";
const COAST = "#A9BFCB";

export default function RegionsIndexPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">권역별로 둘러보기</h1>
      <p className="-mt-2 text-[15px] text-text-muted">
        권역을 선택하면 그 지역 여행지를 지도 위에 이름과 함께 표시해 드려요.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {REGIONS.map((region) => {
          const theme = REGION_THEME[region];
          const spots = SPOTS.filter((s) => s.region === region);
          const viewBox = KOREA_FULL_VIEWBOX;
          return (
            <Link
              key={region}
              href={`/regions/${region}`}
              className="flex flex-col gap-2 rounded-2xl bg-bg-subtle p-2 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
            >
              <svg
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                className="aspect-square w-full rounded-xl"
                style={{ background: SEA }}
              >
                {KOREA_LAND_PATHS.map((path) => (
                  <path key={path.slice(0, 24)} d={path} fill={LAND} stroke={COAST} strokeWidth={1.4} />
                ))}
                {spots.map((spot) => {
                  const point = project(spot.lat, spot.lng);
                  return (
                    <circle
                      key={spot.id}
                      cx={point.x}
                      cy={point.y}
                      r={7}
                      fill={theme.accent}
                      stroke="white"
                      strokeWidth={1.8}
                    />
                  );
                })}
              </svg>
              <div className="px-1 pb-1 text-center">
                <div className="text-[15px] font-semibold tracking-tight text-text">{region}</div>
                <div className="text-[12px] text-text-faint">{spots.length}곳</div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
