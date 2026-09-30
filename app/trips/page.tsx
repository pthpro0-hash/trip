import type { Metadata } from "next";
import Link from "next/link";
import { TripList } from "@/components/trip/TripList";
import { StorageTidy } from "@/components/trip/StorageTidy";

export const metadata: Metadata = {
  title: "여행 목록",
  description: "다녀온 곳을 모아 봅니다.",
  robots: { index: false, follow: false },
};

export default function TripsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">여행 목록</h1>
          <p className="mt-1 text-[15px] text-text-muted">다녀온 곳을 모아 봅니다</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/sketch"
            className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
          >
            한장 요약
          </Link>
          <Link
            href="/trips/new"
            className="rounded-full bg-bg-subtle px-3.5 py-1.5 text-[13px] font-medium text-text transition hover:bg-line"
          >
            + 사진 고르기
          </Link>
        </div>
      </div>
      <TripList />
      <StorageTidy />
    </main>
  );
}
