import type { Metadata } from "next";
import Link from "next/link";
import { TripList } from "@/components/trip/TripList";

export const metadata: Metadata = {
  title: "내 여행",
  description: "다녀온 곳을 모아 봅니다.",
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">내 여행</h1>
          <p className="mt-1 text-[15px] text-text-muted">다녀온 곳을 모아 봅니다</p>
        </div>
        <Link
          href="/trips/new"
          className="shrink-0 rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
        >
          사진에서 찾기
        </Link>
      </div>
      <TripList />
    </main>
  );
}
