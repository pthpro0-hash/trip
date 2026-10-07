import type { Metadata } from "next";
import { MyInfo } from "@/components/me/MyInfo";

export const metadata: Metadata = {
  title: "내 정보",
  description: "가족 공유, 가족 우편함, 보관함 정리를 한 곳에서.",
  robots: { index: false, follow: false },
};

export default function MePage() {
  return <MyInfo />;
}
