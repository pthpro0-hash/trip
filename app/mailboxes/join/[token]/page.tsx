import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MailboxJoinCard } from "@/components/mailbox/MailboxJoinCard";
import { getCurrentUser } from "@/lib/supabase/server";
import { isMailboxToken } from "@/lib/mailbox";

export const metadata: Metadata = {
  title: "가족 책장 초대",
  robots: { index: false, follow: false },
};

/*
  보내는 사람 초대 링크로 들어오는 곳. 열기만 해서는 아무것도 바뀌지 않는다 — 보내는 사람이 되는
  것은 "수락"을 눌렀을 때다(링크 미리보기나 메신저가 주소를 대신 열어도 연결되지 않게).
  로그인이 먼저라, 안 했으면 로그인하고 이 자리로 돌아온다.
*/
export default async function MailboxJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isMailboxToken(token)) return <MailboxJoinCard token={null} />;

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/mailboxes/join/${token}`)}`);

  return <MailboxJoinCard token={token} />;
}
