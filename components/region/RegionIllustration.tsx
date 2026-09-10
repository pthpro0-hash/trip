import type { Region } from "@/lib/types";

interface IconProps {
  x: number;
  y: number;
  size: number;
  color: string;
  opacity?: number;
}

// A handful of flat, single-color glyphs — not real artwork, just enough
// visual character per region (mountain ridge, palace roofline, rice-field
// rows, waves, a volcano) to tell the six region cards apart at a glance.
function Mountain({ x, y, size, color, opacity = 1 }: IconProps) {
  return (
    <path
      d={`M ${x - size} ${y + size * 0.6} L ${x - size * 0.15} ${y - size * 0.7} L ${x + size * 0.25} ${y - size * 0.1} L ${x + size * 0.6} ${y - size * 0.5} L ${x + size} ${y + size * 0.6} Z`}
      fill={color}
      opacity={opacity}
    />
  );
}

function Roofline({ x, y, size, color, opacity = 1 }: IconProps) {
  return (
    <path
      d={`M ${x - size} ${y} Q ${x - size * 0.5} ${y - size * 0.15} ${x - size * 0.35} ${y - size * 0.55} Q ${x} ${y - size} ${x + size * 0.35} ${y - size * 0.55} Q ${x + size * 0.5} ${y - size * 0.15} ${x + size} ${y} Z`}
      fill={color}
      opacity={opacity}
    />
  );
}

function Wave({ x, y, size, color, opacity = 1 }: IconProps) {
  return (
    <path
      d={`M ${x - size} ${y} Q ${x - size * 0.5} ${y - size * 0.4} ${x} ${y} Q ${x + size * 0.5} ${y + size * 0.4} ${x + size} ${y}`}
      stroke={color}
      strokeWidth={size * 0.16}
      fill="none"
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

function FieldRows({ x, y, size, color, opacity = 1 }: IconProps) {
  return (
    <g stroke={color} strokeWidth={size * 0.1} strokeLinecap="round" opacity={opacity}>
      <line x1={x - size} y1={y} x2={x + size} y2={y} />
      <line x1={x - size} y1={y + size * 0.35} x2={x + size} y2={y + size * 0.35} />
      <line x1={x - size} y1={y + size * 0.7} x2={x + size} y2={y + size * 0.7} />
    </g>
  );
}

function Volcano({ x, y, size, color, opacity = 1 }: IconProps) {
  return (
    <g opacity={opacity}>
      <path
        d={`M ${x - size} ${y + size * 0.5} L ${x - size * 0.3} ${y - size * 0.8} L ${x} ${y - size * 0.5} L ${x + size * 0.3} ${y - size * 0.8} L ${x + size} ${y + size * 0.5} Z`}
        fill={color}
      />
      <circle cx={x} cy={y - size * 0.72} r={size * 0.12} fill={color} />
    </g>
  );
}

const REGION_ICONS: Record<Region, (color: string, opacity: number) => React.ReactNode> = {
  수도권: (color, o) => (
    <>
      <Roofline x={18} y={22} size={11} color={color} opacity={o} />
      <Roofline x={84} y={16} size={8} color={color} opacity={o} />
    </>
  ),
  강원권: (color, o) => (
    <>
      <Mountain x={16} y={20} size={12} color={color} opacity={o} />
      <Mountain x={85} y={18} size={9} color={color} opacity={o} />
    </>
  ),
  충청권: (color, o) => (
    <>
      <FieldRows x={16} y={16} size={10} color={color} opacity={o} />
      <FieldRows x={85} y={22} size={8} color={color} opacity={o} />
    </>
  ),
  전라권: (color, o) => (
    <>
      <Wave x={17} y={18} size={11} color={color} opacity={o} />
      <FieldRows x={85} y={16} size={8} color={color} opacity={o} />
    </>
  ),
  경상권: (color, o) => (
    <>
      <Mountain x={16} y={19} size={10} color={color} opacity={o} />
      <Wave x={85} y={20} size={9} color={color} opacity={o} />
    </>
  ),
  제주권: (color, o) => (
    <>
      <Volcano x={17} y={20} size={11} color={color} opacity={o} />
      <Wave x={85} y={18} size={9} color={color} opacity={o} />
    </>
  ),
};

interface RegionIllustrationProps {
  region: Region;
  color: string;
  opacity?: number;
}

// Pure decoration, rendered behind the pin layer — a <g> of background
// glyphs sized for a 0..100 viewBox so it composes with computeRegionPins'
// coordinate space.
export function RegionIllustration({ region, color, opacity = 0.35 }: RegionIllustrationProps) {
  return <g aria-hidden="true">{REGION_ICONS[region](color, opacity)}</g>;
}
