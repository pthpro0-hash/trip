import type { Metadata } from "next";
import { SketchView } from "@/components/sketch/SketchView";

export const metadata: Metadata = {
  title: "한장 요약",
  description: "한 해의 여행을 한 장의 그림과 이야기로 모아 봅니다.",
  robots: { index: false, follow: false },
};

export default function SketchPage() {
  return (
    // 제목은 SketchView 안에 있다 — 해 탭과 한 줄에 두려고.
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 pb-16 pt-5">
      <SketchView />
    </main>
  );
}
