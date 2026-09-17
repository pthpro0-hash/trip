import type { Spot } from "./types";

export interface RegionCluster {
  label: string;
  spots: Spot[];
}

// Sort order for each split axis runs low→high (south→north for lat,
// west→east for lng), so these label lists must stay in that same order —
// chunk 0 is always the "남부"/"서부" end.
const LAT_LABELS_BY_COUNT: Record<number, string[]> = {
  2: ["남부", "북부"],
  3: ["남부", "중부", "북부"],
  4: ["남부", "중남부", "중북부", "북부"],
};
const LNG_LABELS_BY_COUNT: Record<number, string[]> = {
  2: ["서부", "동부"],
  3: ["서부", "중부", "동부"],
  4: ["서부", "중서부", "중동부", "동부"],
};

function labelChunks(axis: "lat" | "lng", count: number): string[] {
  const table = axis === "lat" ? LAT_LABELS_BY_COUNT : LNG_LABELS_BY_COUNT;
  return table[count] ?? Array.from({ length: count }, (_, i) => `${i + 1}구역`);
}

// A region's spots read as one crowded blob past a certain count, and every
// marker on the map carries a name label that needs room around it — about ten
// per map is what fits before labels start getting dropped. Past that the
// region is split into geographically contiguous groups along whichever axis
// (lat or lng) it spans more: not administrative boundaries, just an even
// geographic slice.
export function splitRegionIntoClusters(spots: Spot[], maxClusterSize = 10): RegionCluster[] {
  if (spots.length <= maxClusterSize) return [{ label: "", spots }];

  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const latRange = Math.max(...lats) - Math.min(...lats);
  const lngRange = Math.max(...lngs) - Math.min(...lngs);
  const axis: "lat" | "lng" = latRange >= lngRange ? "lat" : "lng";

  const sorted = [...spots].sort((a, b) => a[axis] - b[axis]);
  const clusterCount = Math.ceil(spots.length / maxClusterSize);
  const chunkSize = Math.ceil(sorted.length / clusterCount);

  const chunks: Spot[][] = [];
  for (let i = 0; i < sorted.length; i += chunkSize) {
    chunks.push(sorted.slice(i, i + chunkSize));
  }

  const labels = labelChunks(axis, chunks.length);
  return chunks.map((chunk, i) => ({ label: labels[i] ?? `${i + 1}구역`, spots: chunk }));
}
