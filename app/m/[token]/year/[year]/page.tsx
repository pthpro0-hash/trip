import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { asOpened, fetchMailboxView } from "@/lib/supabase/mailboxPublic";
import { isMailboxToken, isPreview } from "@/lib/mailbox";
import { YearBookView } from "@/components/mailbox/receive/YearBookView";

/*
  가족 우편함 · 올해의 책. 열어 본 엽서들에서 그해를 한 권으로 묶어 보여 준다(저장하지 않고 그때그때 만든다).

  우편함 목록(mailbox_view)을 읽어 계산한다 — 링크가 새로 만들어졌거나 우편함이 닫혔으면 곧바로 열리지 않아야
  하므로 요청마다 새로 읽는다. 검색에는 나오지 않게 한다.
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
  params: Promise<{ token: string; year: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "올해의 책",
    robots: { index: false, follow: false },
    manifest: `/m/${token}/manifest.webmanifest`,
  };
}

export default async function YearBookPage({ params, searchParams }: Props) {
  const { token, year } = await params;
  // 네 자리 해만. 엉뚱한 글자는 없는 주소다.
  if (!/^\d{4}$/.test(year)) notFound();
  const preview = isPreview((await searchParams).preview);
  const view = await load(token);
  if (!view) notFound();
  return <YearBookView token={token} view={preview === "all" ? asOpened(view) : view} year={year} preview={preview} />;
}
