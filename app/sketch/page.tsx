import type { Metadata } from "next";
import { SketchView } from "@/components/sketch/SketchView";

export const metadata: Metadata = {
  title: "한 장으로 보기",
  description: "지금까지 다녀온 곳을 한 장으로 모아 봅니다.",
  robots: { index: false, follow: false },
};

export default function SketchPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">
          한 장으로 보기
        </h1>
        <p className="mt-1 text-[15px] text-text-muted">지금까지 다녀온 곳을 한 장으로</p>
      </div>
      <SketchView />
    </main>
  );
}
