import type { Metadata } from "next";
import { PhotoImport } from "@/components/trip/PhotoImport";

export const metadata: Metadata = {
  title: "사진에서 여행 찾기",
  description: "사진을 고르면 언제 어디를 다녀왔는지 찾아 여행으로 묶어 드립니다.",
  robots: { index: false, follow: false },
};

export default function NewTripPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">
          사진에서 여행 찾기
        </h1>
        <p className="mt-1 text-[15px] text-text-muted">
          기억나지 않는 사진도 언제 어디서 찍혔는지는 사진이 알고 있어요
        </p>
      </div>
      <PhotoImport />
    </main>
  );
}
