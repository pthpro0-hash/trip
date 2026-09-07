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
  // Next.js passes the raw (percent-encoded) path segment here rather than a
  // decoded string, so non-ASCII ids (e.g. Korean spot names) never match
  // `spot.id` without an explicit decode first. A malformed percent-sequence
  // (e.g. a bare "%") makes decodeURIComponent throw, so guard it and treat
  // that the same as an unknown slug instead of letting it crash the render.
  let decodedSlug: string;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    notFound();
  }
  const spot = SPOTS.find((s) => s.id === decodedSlug);
  if (!spot) notFound();

  const related = getRelatedSpots(SPOTS, spot, 3);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <Link href="/" className="text-sm text-text-muted hover:text-text">
        ← 목록으로
      </Link>
      <h1 className="font-[family-name:var(--font-heading)] text-3xl text-text">{spot.name}</h1>
      <p className="text-text">{spot.summary}</p>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="font-[family-name:var(--font-heading)] text-lg text-text">꼭 볼 것</h2>
        <ul className="mt-1 list-inside list-disc text-sm text-text-muted">
          {spot.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap gap-4 rounded-2xl border border-border bg-surface p-4 text-sm">
        <div>
          <span className="font-semibold text-text">추천 계절: </span>
          {spot.seasons.join(", ")}
          {spot.seasonNote ? ` (${spot.seasonNote})` : ""}
        </div>
        <div>
          <span className="font-semibold text-text">특산물: </span>
          {spot.specialty.join(", ")}
        </div>
        <div>
          <span className="font-semibold text-text">대표 음식: </span>
          {spot.foods.join(", ")}
        </div>
      </section>

      <div className="h-[300px] rounded-2xl border-2 border-gold bg-surface p-1.5 shadow-sm">
        <div className="h-full overflow-hidden rounded-xl">
          <KakaoMap spots={[spot]} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="font-[family-name:var(--font-heading)] text-lg text-text">같은 권역 다른 추천</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/spots/${r.id}`}
                  className="text-gold underline decoration-gold-dark/50 underline-offset-2 hover:decoration-gold"
                >
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
