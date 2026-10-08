import type { Metadata } from "next";
import { PhotoImport } from "@/components/trip/PhotoImport";

export const metadata: Metadata = {
  title: "사진으로 여행 추가",
  description: "사진을 고르면 언제 어디를 다녀왔는지 찾아 여행으로 묶어 드립니다.",
  robots: { index: false, follow: false },
};

export default function NewTripPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">사진으로 여행 추가</h1>
      <PhotoImport />
    </main>
  );
}
