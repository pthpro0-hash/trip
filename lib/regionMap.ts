import type { Spot } from "./types";

export interface RegionPin {
  id: string;
  name: string;
  x: number;
  y: number;
}

// Places each spot at a position (0-100, 0-100) reflecting its real lat/lng
// relative to the other spots in the same region — not a true map projection,
// just a linear normalization within the region's own bounding box, inset by
// `padding` so pins never sit flush against the illustration's edge.
export function computeRegionPins(spots: Spot[], padding = 14): RegionPin[] {
  if (spots.length === 0) return [];

  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const scale = (t: number) => padding + (t * (100 - 2 * padding)) / 100;

  return spots.map((spot) => {
    const rawX = lngSpan === 0 ? 50 : ((spot.lng - minLng) / lngSpan) * 100;
    // Latitude increases northward but SVG y increases downward, so invert.
    const rawY = latSpan === 0 ? 50 : ((maxLat - spot.lat) / latSpan) * 100;
    return { id: spot.id, name: spot.name, x: scale(rawX), y: scale(rawY) };
  });
}
