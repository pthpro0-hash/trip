import type { Metadata } from "next";
import Link from "next/link";
import { MailboxPanel } from "@/components/mailbox/MailboxPanel";

export const metadata: Metadata = {
  title: "가족 우편함",
  description: "여행 엽서를 부모님께 보내요.",
  robots: { index: false, follow: false },
};

export default function MailboxesPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-20 pt-8">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-text">가족 우편함</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
          다녀온 여행을 엽서로 만들어 부모님께 보내요. 받는 분은 앱도 로그인도 없이 링크 하나로 열어 보고 답장해요.
        </p>
        <p className="mt-2 text-[14px] text-text-faint">
          내 여행을 가족과 함께 보려면{" "}
          <Link href="/family" className="font-medium text-accent hover:text-accent-hover">
            가족 공유
          </Link>
          를 쓰세요.
        </p>
      </header>
      <MailboxPanel />
    </main>
  );
}
