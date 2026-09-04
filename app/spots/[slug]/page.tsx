import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { getRelatedSpots } from "@/lib/related";
import { KakaoMap } from "@/components/map/KakaoMap";
import Link from "next/link";

const SPOTS = spotsData as Spot[];

export function generateStaticParams() {
  return SPOTS.map((spot) => ({ slug: spot.id }));
}

export default async function SpotDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spot = SPOTS.find((s) => s.id === slug);
  if (!spot) notFound();

  const related = getRelatedSpots(SPOTS, spot, 3);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/" className="text-sm text-neutral-500">
        ← 목록으로
      </Link>
      <h1 className="text-2xl font-bold">{spot.name}</h1>
      <p className="text-neutral-700">{spot.summary}</p>

      <section>
        <h2 className="font-semibold">꼭 볼 것</h2>
        <ul className="list-inside list-disc text-sm text-neutral-700">
          {spot.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="font-semibold">추천 계절: </span>
          {spot.seasons.join(", ")}
          {spot.seasonNote ? ` (${spot.seasonNote})` : ""}
        </div>
        <div>
          <span className="font-semibold">특산물: </span>
          {spot.specialty.join(", ")}
        </div>
        <div>
          <span className="font-semibold">대표 음식: </span>
          {spot.foods.join(", ")}
        </div>
      </section>

      <div className="h-[300px]">
        <KakaoMap spots={[spot]} />
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="font-semibold">같은 권역 다른 추천</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/spots/${r.id}`} className="text-blue-600 hover:underline">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
