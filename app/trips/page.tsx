import { redirect } from "next/navigation";
import { LIST_HREF } from "@/lib/nav";

/*
  옛 주소.

  /trips 는 예전에 따로 선 목록 화면이었다. 지금 목록은 내 여행 화면의 한
  모습이라(lib/nav 참고) 북마크나 옛 링크로 들어온 사람을 그리로 넘긴다.
*/
export default function TripsPage(): never {
  redirect(LIST_HREF);
}
