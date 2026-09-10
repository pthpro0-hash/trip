import Link from "next/link";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";
import { RegionIllustration } from "@/components/region/RegionIllustration";

const SPOTS = spotsData as Spot[];

export default function RegionsIndexPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <Link href="/" className="text-sm text-text-muted hover:text-text">
        ← 목록으로
      </Link>
      <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">권역별로 둘러보기</h1>
      <p className="text-sm text-text-muted">권역을 선택하면 그 지역 여행지를 지도 위 번호로 한눈에 볼 수 있어요.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {REGIONS.map((region) => {
          const theme = REGION_THEME[region];
          const count = SPOTS.filter((s) => s.region === region).length;
          return (
            <Link
              key={region}
              href={`/regions/${region}`}
              className="flex flex-col gap-2 rounded-2xl border-2 p-2 shadow-sm transition hover:brightness-110"
              style={{ borderColor: theme.accent }}
            >
              <svg
                viewBox="0 0 100 100"
                className="aspect-square w-full rounded-xl"
                style={{ background: `linear-gradient(160deg, ${theme.accent}33, ${theme.accentDark}55)` }}
              >
                <RegionIllustration region={region} color={theme.accent} opacity={0.5} />
                <text
                  x={50}
                  y={54}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="bold"
                  fill="white"
                >
                  {region}
                </text>
              </svg>
              <div className="px-1 pb-1 text-center text-xs text-text-muted">{count}곳</div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
