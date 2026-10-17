import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExampleView } from "@/components/example/ExampleView";
import { buildExample } from "@/lib/example";

/*
  예시 여행. 로그인 없이, 사진을 고르기 전에 "사진 → 여행 → 지도와 한 장 카드"가 어떻게 되는지 본다.
  자료는 빌드할 때 한 번 만들어 둔다(lib/example) — 서버에 묻는 것이 없다.
*/

export const metadata: Metadata = {
  title: "예시 여행 보기",
  description: "사진만 고르면 여행이 어떻게 정리되는지 예시로 보세요. 날짜와 장소로 묶고, 지도와 한 장 카드로 만들어 드려요.",
  alternates: { canonical: "/example" },
};

export default function ExamplePage() {
  const example = buildExample();
  if (!example) notFound();
  return <ExampleView example={example} />;
}
