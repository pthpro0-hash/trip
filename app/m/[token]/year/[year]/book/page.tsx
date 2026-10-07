import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { asOpened, fetchMailboxPostcard, fetchMailboxView } from "@/lib/supabase/mailboxPublic";
import { isMailboxToken, isPreview } from "@/lib/mailbox";
import { yearBook } from "@/lib/mailboxYearBook";
import { YearBookPrint } from "@/components/mailbox/receive/YearBookPrint";

/*
  가족 책장 · 올해의 책을 쪽으로 나눠 PDF 로 저장하는 화면.

  책에 넣는 사진 목록은 엽서 한 장씩 읽어 와야 알 수 있다(책장 목록에는 표지와 사진 수만 있다). 그해 열어 본 책이 열 권
  안팎이라 한 번에 읽는다. 읽지 못한 엽서는 표지 사진 하나만으로 쪽을 만든다. 링크가 새로 만들어졌거나 책장이 닫혔으면
  곧바로 열리지 않아야 하므로 요청마다 새로 읽는다. 검색에는 나오지 않게 한다.
*/

const client = () =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const load = cache(async (token: string) => {
  await connection();
  if (!isSupabaseConfigured || !isMailboxToken(token)) return null;
  try {
    return await fetchMailboxView(client(), token);
  } catch {
    return null;
  }
});

type Props = {
  params: Promise<{ token: string; year: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token, year } = await params;
  return {
    // 인쇄 창에서 PDF 로 저장할 때 이 제목이 파일 이름이 된다.
    title: `${year}년 우리 가족 올해의 책`,
    robots: { index: false, follow: false },
    manifest: `/m/${token}/manifest.webmanifest`,
  };
}

export default async function YearBookPrintPage({ params, searchParams }: Props) {
  const { token, year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const preview = isPreview((await searchParams).preview);
  const loaded = await load(token);
  if (!loaded) notFound();
  const view = preview === "all" ? asOpened(loaded) : loaded;

  const book = view.settings.year ? yearBook(view.postcards, year) : null;
  const filesById: Record<string, string[]> = {};
  if (book) {
    const supabase = client();
    const cards = await Promise.all(
      book.cards.map((card) => fetchMailboxPostcard(supabase, token, card.id).catch(() => null)),
    );
    book.cards.forEach((card, index) => {
      filesById[card.id] = cards[index]?.snapshot.files ?? (card.cover ? [card.cover] : []);
    });
  }
  return <YearBookPrint token={token} view={view} year={year} filesById={filesById} preview={preview} />;
}
