import Link from "next/link";
import type { Region, Spot } from "@/lib/types";
import { computeRegionPins } from "@/lib/regionMap";
import { REGION_THEME } from "@/lib/regionTheme";
import { RegionIllustration } from "./RegionIllustration";

interface RegionMapProps {
  region: Region;
  spots: Spot[];
}

// Renders spots.length numbered pins on a stylized (not geographically
// accurate) illustrated card, plus a matching numbered legend below it —
// the legend is what stays usable once a region has enough spots that the
// pins themselves get visually crowded.
export function RegionMap({ region, spots }: RegionMapProps) {
  const theme = REGION_THEME[region];
  const pins = computeRegionPins(spots);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="overflow-hidden rounded-2xl border-2 p-1.5 shadow-sm"
        style={{ borderColor: theme.accent }}
      >
        <svg
          viewBox="0 0 100 100"
          className="aspect-square w-full rounded-xl"
          style={{ background: `linear-gradient(160deg, ${theme.accent}33, ${theme.accentDark}55)` }}
        >
          <RegionIllustration region={region} color={theme.accent} opacity={0.4} />
          {pins.map((pin, index) => (
            <a key={pin.id} href={`/spots/${pin.id}`}>
              <title>{pin.name}</title>
              <circle
                cx={pin.x}
                cy={pin.y}
                r={2.6}
                fill={theme.accentDark}
                stroke="white"
                strokeWidth={0.6}
              />
              <text
                x={pin.x}
                y={pin.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={2.4}
                fontWeight="bold"
                fill="white"
              >
                {index + 1}
              </text>
            </a>
          ))}
        </svg>
      </div>

      <ol className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {spots.map((spot, index) => (
          <li key={spot.id}>
            <Link href={`/spots/${spot.id}`} className="flex items-baseline gap-1.5 text-text hover:text-gold">
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: theme.accentDark }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="truncate">{spot.name}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
