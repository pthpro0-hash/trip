import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchMailboxView } from "@/lib/supabase/mailboxPublic";
import { isMailboxToken, isPreview } from "@/lib/mailbox";
import { WishView } from "@/components/mailbox/receive/WishView";

/*
  가족 책장 · 가고 싶은 곳 보내기. 부모님이 여행 100선에서 가고 싶은 곳을 골라 가족에게 보낸다 — 로그인이 없다.

  책장 목록(mailbox_view)에서 이 책장이 이미 받은 곳을 읽는다. 링크가 새로 만들어졌거나 책장이 닫혔으면 곧바로 열리지
  않아야 하므로 요청마다 새로 읽는다. 검색에는 나오지 않게 한다.
*/

const load = cache(async (token: string) => {
  await connection();
  if (!isSupabaseConfigured || !isMailboxToken(token)) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    return await fetchMailboxView(supabase, token);
  } catch {
    return null;
  }
});

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "가고 싶은 곳 보내기",
    robots: { index: false, follow: false },
    manifest: `/m/${token}/manifest.webmanifest`,
  };
}

export default async function WishPage({ params, searchParams }: Props) {
  const { token } = await params;
  const preview = isPreview((await searchParams).preview);
  const view = await load(token);
  if (!view) notFound();
  return <WishView token={token} view={view} preview={preview} />;
}
