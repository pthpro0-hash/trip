import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { asOpened, fetchMailboxView } from "@/lib/supabase/mailboxPublic";
import { isMailboxToken, isPreview } from "@/lib/mailbox";
import { MailboxHome } from "@/components/mailbox/receive/MailboxHome";

/*
  가족 우편함 · 받는 쪽 첫 화면. 부모님이 링크 하나로 들어온다 — 로그인이 없다.

  링크의 글자를 받아 그 우편함 것만 읽는다(supabase/mailbox.sql 의 mailbox_view). 링크를 새로
  만들었거나 우편함을 닫았으면 곧바로 열리지 않아야 하므로 요청마다 새로 읽는다.
  검색에는 나오지 않게 한다. robots.txt 로 막지는 않는다 — 막으면 카톡이 미리보기를 가지러 오지 못한다.
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

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ preview?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    // 우편함 이름은 보낸 사람이 정한 사적인 이름이라 제목에 쓰지 않는다.
    title: "가족 우편함",
    robots: { index: false, follow: false },
    // 홈 화면에 추가하면 이 우편함을 바로 여는 아이콘이 된다.
    manifest: `/m/${token}/manifest.webmanifest`,
  };
}

export default async function MailboxPage({ params, searchParams }: Props) {
  const { token } = await params;
  // ?preview=1 — 보내는 사람이 부모님 화면을 미리 보는 중. 화면이 무엇을 보내지 않을지만 정한다.
  const preview = isPreview((await searchParams).preview);
  const view = await load(token);
  if (!view) notFound();
  return <MailboxHome token={token} view={preview === "all" ? asOpened(view) : view} preview={preview} />;
}
