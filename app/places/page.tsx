import { redirect } from "next/navigation";
import { MAP_HREF } from "@/lib/nav";

/*
  옛 주소.

  /places 는 같은 이름으로 다녀온 때를 모아 보던 화면이었다. 여행 상세와 지도의 창이 같은 것을 보여 줘서
  뺐다(2026-10-14). 옛 링크로 들어온 사람은 내 여행 지도로 넘긴다.
*/
export default function PlacesPage(): never {
  redirect(MAP_HREF);
}
