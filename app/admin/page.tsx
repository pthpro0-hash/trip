import type { Metadata } from "next";
import { AdminHome } from "@/components/admin/AdminHome";

export const metadata: Metadata = {
  title: "회원 관리",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">회원 관리</h1>
      <AdminHome />
    </main>
  );
}
