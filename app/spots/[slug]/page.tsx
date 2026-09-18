import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { getRelatedSpots } from "@/lib/related";
import { getSpotMedia, PHOTO_CREDIT } from "@/lib/media";
import { KakaoMap } from "@/components/map/KakaoMap";
import { SpotGallery } from "@/components/spot/SpotGallery";
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
  const media = getSpotMedia(spot.id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">{spot.name}</h1>
        <p className="text-[17px] leading-relaxed text-text-muted">{spot.summary}</p>
      </div>

      {media && media.images.length > 0 && <SpotGallery name={spot.name} images={media.images} />}

      <section className="rounded-2xl bg-bg-subtle p-5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">꼭 볼 것</h2>
        <ul className="mt-2 flex flex-col gap-1 text-[15px] text-text">
          {spot.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap gap-x-8 gap-y-3 rounded-2xl bg-bg-subtle p-5 text-[15px]">
        <div>
          <span className="text-text-faint">추천 계절: </span>
          {spot.seasons.join(", ")}
          {spot.seasonNote ? ` (${spot.seasonNote})` : ""}
        </div>
        <div>
          <span className="text-text-faint">특산물: </span>
          {spot.specialty.join(", ")}
        </div>
        <div>
          <span className="text-text-faint">대표 음식: </span>
          {spot.foods.join(", ")}
        </div>
      </section>

      <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-line">
        <KakaoMap spots={[spot]} />
      </div>

      {media && media.overview && (
        <section className="rounded-2xl bg-bg-subtle p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">자세한 소개</h2>
          <div className="mt-3 flex flex-col gap-3 text-[15px] leading-[1.7] text-text">
            {media.overview.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          {media.homepage && (
            <a
              href={media.homepage}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-block text-[15px] font-medium text-accent hover:text-accent-hover"
            >
              공식 홈페이지 →
            </a>
          )}
          <p className="mt-4 text-[12px] text-text-faint">{PHOTO_CREDIT}</p>
        </section>
      )}

      {related.length > 0 && (
        <section className="rounded-2xl bg-bg-subtle p-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">같은 권역 다른 추천</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {related.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/spots/${r.id}`}
                  className="text-[15px] font-medium text-accent hover:text-accent-hover"
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
