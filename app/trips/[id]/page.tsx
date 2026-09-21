import type { Metadata } from "next";
import Link from "next/link";
import { TripDetail } from "@/components/trip/TripDetail";

export const metadata: Metadata = {
  title: "여행 기록",
  robots: { index: false, follow: false },
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href="/trips" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 내 여행
      </Link>
      <TripDetail tripId={id} />
    </main>
  );
}
