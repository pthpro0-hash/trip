import type { Metadata } from "next";
import { BackToSketches } from "@/components/trip/BackToSketches";
import { ScrollTop } from "@/components/layout/ScrollTop";
import { TripDetail } from "@/components/trip/TripDetail";

export const metadata: Metadata = {
  title: "여행 기록",
  robots: { index: false, follow: false },
};

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <BackToSketches />
      <TripDetail tripId={id} />
      {/* 사진이 수십 장이라 화면이 길다. 늘 같은 자리에 둔다. */}
      <ScrollTop />
    </main>
  );
}
