import Link from "next/link";
import type { Spot } from "@/lib/types";
import { REGIONS } from "@/lib/regions";
import { REGION_THEME } from "@/lib/regionTheme";

interface RegionStripProps {
  spots: Spot[];
}

/*
  권역으로 들어가는 문. 예전에는 머리말 구석의 회색 알약 하나였는데,
  그 자리에서는 아무도 누르지 않는다. 권역마다 제 색을 가지고 있으니
  그 색을 그대로 써서 여섯 칸을 늘어놓는 편이 훨씬 잘 보인다.
*/
export function RegionStrip({ spots }: RegionStripProps) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-text">권역별로 둘러보기</h2>
        <Link
          href="/regions"
          className="shrink-0 text-[13px] font-medium text-accent hover:text-accent-hover"
        >
          지도로 한눈에 →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {REGIONS.map((region) => {
          const theme = REGION_THEME[region];
          const count = spots.filter((spot) => spot.region === region).length;
          return (
            <Link
              key={region}
              href={`/regions/${region}`}
              className="group relative overflow-hidden rounded-xl bg-bg-subtle py-2.5 pl-3.5 pr-2.5 ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"
            >
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: theme.accent }}
                aria-hidden="true"
              />
              <span className="block text-[14px] font-semibold tracking-tight text-text">
                {region}
              </span>
              <span className="block text-[11px] text-text-faint">{count}곳</span>
              {/* 좁은 화면에서는 이름과 개수만으로 충분하다. */}
              <span className="mt-1 hidden truncate text-[11px] text-text-muted sm:block">
                {theme.tagline}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
