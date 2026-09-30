import { project } from "@/lib/koreaMap";
import { SIDO } from "@/lib/sido";

export interface SidoShape {
  name: string;
  /** 지도 단위(project)로 옮긴 경로. 구멍은 evenodd 로 뚫는다. */
  d: string;
}

/*
  시도 경계를 지도 단위 경로로 한 번만 옮겨 둔다. 점이 수천 개라 카드를
  그릴 때마다 옮길 이유가 없다.
*/
let shapes: { list: SidoShape[]; points: { lat: number; lng: number }[] } | null = null;
export function sidoShapes() {
  if (shapes) return shapes;
  const points: { lat: number; lng: number }[] = [];
  const list = SIDO.map((sido) => {
    const d = sido.polygons
      .flatMap((polygon) =>
        polygon.map((ring) => {
          const moved = ring.map(([lng, lat]) => {
            points.push({ lat, lng });
            const p = project(lat, lng);
            return `${Math.round(p.x * 10) / 10} ${Math.round(p.y * 10) / 10}`;
          });
          return `M${moved.join("L")}Z`;
        }),
      )
      .join("");
    return { name: sido.name, d };
  });
  shapes = { list, points };
  return shapes;
}
