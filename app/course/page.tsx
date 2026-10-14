import { redirect } from "next/navigation";
import { SPOTS_HREF } from "@/lib/nav";

/*
  옛 주소.

  /course 는 가고 싶은 곳을 골라 순서를 정하던 '이번 여행'(코스 짜기) 화면이었다. 쓰는 사람에게 복잡하기만 해서
  뺐다(2026-10-14). 북마크나 옛 링크로 들어온 사람은 여행 100선으로 넘긴다 — 담아 둔 곳은 거기서 그대로 보인다.
*/
export default function CoursePage(): never {
  redirect(SPOTS_HREF);
}
