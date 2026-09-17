export interface MapPoint {
  x: number;
  y: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LAT_ORIGIN = 39.0;
const LNG_ORIGIN = 125.5;
const SCALE = 100;
// Longitude degrees are shorter than latitude degrees away from the equator;
// cos(36.5°) ≈ 0.8 is close enough across Korea's narrow latitude band to keep
// the coastline from looking stretched east-west.
const LNG_COMPRESSION = 0.8;

export function project(lat: number, lng: number): MapPoint {
  return {
    x: (lng - LNG_ORIGIN) * LNG_COMPRESSION * SCALE,
    y: (LAT_ORIGIN - lat) * SCALE,
  };
}

// Hand-traced coastline control points ([lat, lng], clockwise from the
// north-east corner). Deliberately coarse — roughly one point per 20-30km —
// because this is a stylized locator map, not a survey: it only has to read
// as "Korea" and put pins in believable places relative to the coast.
const MAINLAND: [number, number][] = [
  // 동해안 (북 → 남)
  [38.6, 128.36],
  [38.31, 128.52],
  [38.2, 128.6],
  [38.06, 128.68],
  [37.88, 128.83],
  [37.77, 128.95],
  [37.55, 129.1],
  [37.33, 129.26],
  [37.07, 129.39],
  [36.85, 129.45],
  [36.63, 129.46],
  [36.41, 129.4],
  [36.08, 129.4],
  [35.99, 129.56],
  [35.83, 129.5],
  [35.64, 129.47],
  [35.44, 129.41],
  [35.31, 129.34],
  [35.16, 129.22],
  [35.07, 129.04],
  // 남해안 (동 → 서)
  [35.01, 128.83],
  [34.88, 128.69],
  [34.78, 128.6],
  [34.83, 128.42],
  [34.93, 128.25],
  [34.86, 128.05],
  [34.8, 127.95],
  [34.73, 127.75],
  [34.63, 127.52],
  [34.55, 127.3],
  [34.63, 127.1],
  [34.49, 126.98],
  [34.4, 126.7],
  [34.31, 126.52],
  // 서해안 (남 → 북)
  [34.55, 126.36],
  [34.79, 126.39],
  [35.06, 126.36],
  [35.33, 126.32],
  [35.52, 126.45],
  [35.63, 126.46],
  [35.83, 126.62],
  [35.98, 126.68],
  [36.12, 126.53],
  [36.32, 126.49],
  [36.45, 126.4],
  [36.6, 126.3],
  [36.75, 126.14],
  [36.9, 126.3],
  [36.98, 126.52],
  [36.95, 126.75],
  [37.08, 126.66],
  [37.25, 126.58],
  [37.4, 126.61],
  [37.46, 126.5],
  [37.6, 126.47],
  [37.72, 126.45],
  [37.83, 126.62],
  [37.93, 126.72],
  // 휴전선 (서 → 동)
  [38.05, 126.92],
  [38.14, 127.18],
  [38.24, 127.48],
  [38.31, 127.85],
  [38.3, 128.1],
  [38.44, 128.24],
];

const JEJU: [number, number][] = [
  [33.56, 126.49],
  [33.55, 126.68],
  [33.51, 126.86],
  [33.46, 126.94],
  [33.33, 126.9],
  [33.25, 126.75],
  [33.23, 126.56],
  [33.22, 126.34],
  [33.29, 126.19],
  [33.4, 126.16],
  [33.49, 126.24],
];

const ULLEUNG: [number, number][] = [
  [37.54, 130.85],
  [37.52, 130.92],
  [37.46, 130.92],
  [37.45, 130.84],
  [37.5, 130.8],
];

function format(value: number) {
  return Math.round(value * 100) / 100;
}

// Closed Catmull-Rom spline rendered as cubic béziers, so the sparse control
// points above come out as a rounded coastline instead of a polygon.
function closedSplinePath(points: MapPoint[]): string {
  const n = points.length;
  let d = `M ${format(points[0].x)} ${format(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${format(c1x)} ${format(c1y)}, ${format(c2x)} ${format(c2y)}, ${format(p2.x)} ${format(p2.y)}`;
  }
  return `${d} Z`;
}

function toPath(coords: [number, number][]): string {
  return closedSplinePath(coords.map(([lat, lng]) => project(lat, lng)));
}

export const KOREA_LAND_PATHS: string[] = [MAINLAND, JEJU, ULLEUNG].map(toPath);

export const KOREA_FULL_VIEWBOX: ViewBox = { x: 20, y: 20, width: 340, height: 600 };

// Spots in the same city land almost on top of each other at region zoom, and
// stacked pins hide each other entirely. This nudges colliding markers apart
// by at most `maxOffset` — a legibility adjustment to the drawing only; the
// popup, the list and the Kakao map all still use the real coordinates.
export function spreadPoints(
  points: MapPoint[],
  minDistance: number,
  maxOffset: number,
): MapPoint[] {
  const adjusted = points.map((point) => ({ ...point }));
  const order = adjusted
    .map((_, index) => index)
    .sort((a, b) => adjusted[a].y - adjusted[b].y || adjusted[a].x - adjusted[b].x);
  const settled: MapPoint[] = [];

  for (const index of order) {
    const origin = points[index];
    const current = adjusted[index];

    for (let step = 0; step < 24; step += 1) {
      const collision = settled.find(
        (other) => Math.hypot(other.x - current.x, other.y - current.y) < minDistance,
      );
      if (!collision) break;

      let dx = current.x - collision.x;
      let dy = current.y - collision.y;
      let distance = Math.hypot(dx, dy);
      if (distance < 1e-6) {
        // Exactly coincident: walk a golden-angle spiral so repeated
        // collisions fan out instead of pushing along one direction.
        const angle = step * 2.399963;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      const push = minDistance - distance + minDistance * 0.05;
      current.x += (dx / distance) * push;
      current.y += (dy / distance) * push;

      const offsetX = current.x - origin.x;
      const offsetY = current.y - origin.y;
      const offset = Math.hypot(offsetX, offsetY);
      if (offset > maxOffset) {
        current.x = origin.x + (offsetX / offset) * maxOffset;
        current.y = origin.y + (offsetY / offset) * maxOffset;
        break;
      }
    }

    settled.push(current);
  }

  return adjusted;
}
