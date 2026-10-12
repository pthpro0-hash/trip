import type { Metadata } from "next";
import { AdminSuggestions } from "@/components/spots/AdminSuggestions";

export const metadata: Metadata = {
  title: "추천 관리",
  robots: { index: false, follow: false },
};

export default function AdminSuggestionsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">빠진 곳 추천 관리</h1>
      <AdminSuggestions />
    </main>
  );
}
