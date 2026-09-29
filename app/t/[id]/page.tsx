import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { publicFileUrl } from "@/lib/supabase/shares";
import { fetchSharedTrip } from "@/lib/supabase/tripShares";
import { isShareId } from "@/lib/share";
import { tripShareTitle } from "@/lib/tripShare";
import { SharedTripView } from "@/components/share/SharedTripView";

/*
  링크로 받은 여행 하나.

  로그인하지 않은 사람이 연다. 링크를 만들 때 베껴 둔 것(스냅샷)만 읽고,
  여행 기록에는 닿지 않는다(lib/tripShare.ts). 끊은 링크는 곧바로 없는
  링크가 되어야 하므로 요청마다 새로 읽는다.

  검색에는 나오지 않게 한다. robots.txt 로 막지는 않는다 — 막으면 카톡이
  미리보기 그림을 가지러 오지 못한다.
*/

const load = cache(async (id: string) => {
  // 끊은 링크가 캐시에 남아 계속 열리면 안 된다. 늘 요청 때 읽는다.
  await connection();
  if (!isSupabaseConfigured || !isShareId(id)) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    return await fetchSharedTrip(supabase, id);
  } catch {
    return null;
  }
});

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const shared = await load(id);
  const robots = { index: false, follow: false };
  if (!shared) return { title: "없는 링크", robots };

  const { snapshot } = shared;
  const title = tripShareTitle(snapshot);
  const firstPhoto = snapshot.files[0];
  const image = firstPhoto ? publicFileUrl(id, firstPhoto) : undefined;
  const description = snapshot.subtitle || `${snapshot.visits.length}곳을 다녀온 여행`;
  return {
    title,
    description,
    robots,
    openGraph: {
      type: "article",
      url: `/t/${id}`,
      title,
      description,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function SharedTripPage({ params }: Props) {
  const { id } = await params;
  const shared = await load(id);
  if (!shared) notFound();

  return <SharedTripView id={id} snapshot={shared.snapshot} />;
}
