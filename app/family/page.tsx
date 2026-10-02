import type { Metadata } from "next";
import Link from "next/link";
import { FamilyPanel } from "@/components/family/FamilyPanel";

export const metadata: Metadata = {
  title: "가족 공유",
  description: "내 여행을 가족과 함께 보세요.",
  robots: { index: false, follow: false },
};

export default function FamilyPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-5 pb-20 pt-8">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-text">가족 공유</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
          가족을 초대하면 내 여행 전체를 함께 볼 수 있어요. 보기만, 수정만, 추가도 가능 중에서 권한을 골라요.
        </p>
      </header>
      <FamilyPanel />
      <p className="text-[14px] text-text-faint">
        앱을 쓰지 않는 부모님께 여행을 엽서로 보내려면{" "}
        <Link href="/mailboxes" className="font-medium text-accent hover:text-accent-hover">
          가족 우편함
        </Link>
        을 쓰세요.
      </p>
    </main>
  );
}
