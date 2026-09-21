import type { Metadata } from "next";
import { notFound } from "next/navigation";
import spotsData from "@/lib/data/spots.json";
import type { Spot } from "@/lib/types";
import { getRelatedSpots } from "@/lib/related";
import { getSpotMedia, PHOTO_CREDIT } from "@/lib/media";
import { KakaoMap } from "@/components/map/KakaoMap";
import { SpotGallery } from "@/components/spot/SpotGallery";
import { VisitInfo } from "@/components/spot/VisitInfo";
import { DirectionsLinks } from "@/components/spot/DirectionsLinks";
import { SaveButton } from "@/components/spot/SaveButton";
import Link from "next/link";

const SPOTS = spotsData as Spot[];

export function generateStaticParams() {
  return SPOTS.map((spot) => ({ slug: spot.id }));
}

function findSpot(slug: string): Spot | undefined {
  try {
    return SPOTS.find((s) => s.id === decodeURIComponent(slug));
  } catch {
    return undefined;
  }
}

// 페이지마다 제목·설명·대표 이미지를 따로 준다. 이게 없으면 121개 상세
// 페이지가 검색엔진과 메신저 미리보기에서 전부 같은 글로 보인다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spot = findSpot(slug);
  if (!spot) return { title: "찾을 수 없는 여행지" };

  const media = getSpotMedia(spot.id);
  const title = `${spot.name} — ${spot.region} 여행`;
  const description = spot.summary;
  const images = media?.images[0]?.url ? [{ url: media.images[0].url }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/spots/${spot.id}` },
    openGraph: { title, description, images, type: "article", locale: "ko_KR" },
    twitter: { card: "summary_large_image", title, description, images: images?.map((i) => i.url) },
  };
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

  // 검색엔진이 이 페이지를 '관광지'로 이해하게 해서, 주소·사진·설명이
  // 검색 결과에 함께 노출될 수 있도록 한다.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: spot.name,
    description: spot.summary,
    image: media?.images.map((image) => image.url),
    address: media?.address
      ? { "@type": "PostalAddress", streetAddress: media.address, addressCountry: "KR" }
      : undefined,
    geo: { "@type": "GeoCoordinates", latitude: spot.lat, longitude: spot.lng },
    telephone: media?.practical.phone,
    openingHours: media?.practical.useTime,
    url: `https://yeohaeng-sesang.vercel.app/spots/${spot.id}`,
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-16 pt-8">
      <script
        type="application/ld+json"
        // 구조화 데이터는 우리가 만든 값만 담는다 (사용자 입력 없음).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">{spot.name}</h1>
        <p className="text-[17px] leading-relaxed text-text-muted">{spot.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <SaveButton spotId={spot.id} spotName={spot.name} variant="inline" />
          <Link
            href="/course"
            className="text-[13px] font-medium text-accent hover:text-accent-hover"
          >
            내 코스 →
          </Link>
        </div>
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
        {media?.address && (
          <div className="w-full">
            <span className="text-text-faint">주소: </span>
            {media.address}
          </div>
        )}
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

      {media && <VisitInfo practical={media.practical} />}

      <div className="flex flex-col gap-3">
        <div className="h-[320px] overflow-hidden rounded-2xl ring-1 ring-line">
          <KakaoMap spots={[spot]} />
        </div>
        <DirectionsLinks spot={spot} />
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
