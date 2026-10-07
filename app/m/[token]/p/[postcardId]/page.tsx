import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchMailboxPostcard, postcardFileUrl } from "@/lib/supabase/mailboxPublic";
import { isMailboxToken, isPostcardId, isPreview, postcardTitle } from "@/lib/mailbox";
import { ReceivedPostcardView } from "@/components/mailbox/receive/ReceivedPostcardView";

/*
  가족 책장 · 엽서 한 장. 카톡으로 받은 링크가 바로 여기로 온다.

  읽기만 한다 — 열어 봤다는 표시는 화면이 열린 뒤에 화면이 따로 적는다(미리보기 기계가 읽어도
  찍히지 않게). 거둔 엽서·닫은 책장은 곧바로 열리지 않으므로 요청마다 새로 읽는다.
*/

const load = cache(async (token: string, postcardId: string) => {
  await connection();
  if (!isSupabaseConfigured || !isMailboxToken(token) || !isPostcardId(postcardId)) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    return await fetchMailboxPostcard(supabase, token, postcardId);
  } catch {
    return null;
  }
});

type Props = { params: Promise<{ token: string; postcardId: string }>; searchParams: Promise<{ preview?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, postcardId } = await params;
  const robots = { index: false, follow: false };
  const card = await load(token, postcardId);
  if (!card) return { title: "열리지 않는 엽서", robots };

  // 카톡 미리보기: "지민이 보낸 여행 엽서"와 첫 사진, 인사말 한 줄.
  const title = `${card.senderName}이(가) 보낸 여행 엽서`;
  const description = card.greeting || postcardTitle(card.snapshot);
  const first = card.snapshot.files[0];
  const image = first ? postcardFileUrl(card.id, first) : undefined;
  return {
    title,
    description,
    robots,
    manifest: `/m/${token}/manifest.webmanifest`,
    openGraph: {
      type: "article",
      title,
      description,
      images: image ? [{ url: image, alt: postcardTitle(card.snapshot) }] : undefined,
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PostcardPage({ params, searchParams }: Props) {
  const { token, postcardId } = await params;
  const preview = isPreview((await searchParams).preview);
  const card = await load(token, postcardId);
  if (!card) notFound();
  return <ReceivedPostcardView token={token} card={card} preview={preview} />;
}
