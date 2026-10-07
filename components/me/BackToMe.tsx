import Link from "next/link";
import { ME_HREF } from "@/lib/nav";

/** 가족 공유·가족 우편함 맨 위의 길 — 이 화면들은 내 정보의 한 칸이다. */
export function BackToMe() {
  return (
    <Link href={ME_HREF} className="self-start text-[14px] font-medium text-text-muted transition hover:text-text">
      ← 내 정보
    </Link>
  );
}
