import type { Metadata } from "next";
import Link from "next/link";
import { CoursePlanner } from "@/components/course/CoursePlanner";

// 찜 목록은 이 브라우저에만 있으므로 검색엔진에 올릴 내용이 없다.
export const metadata: Metadata = {
  title: "내 코스",
  description: "찜한 여행지를 순서대로 놓고 이동 거리를 확인하세요.",
  robots: { index: false, follow: true },
};

export default function CoursePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pb-16 pt-8">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <div>
        <h1 className="text-[32px] font-bold tracking-tight text-text md:text-[40px]">내 코스</h1>
        <p className="mt-1 text-[15px] text-text-muted">찜한 곳을 순서대로 놓고 거리를 확인하세요</p>
      </div>
      <CoursePlanner />
    </main>
  );
}
