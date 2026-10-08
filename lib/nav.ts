import { startHref, type Start } from "./start";

/*
  이 서비스의 길.

  위 띠(넓은 화면)와 하단 탭(폰), 뒤로 가기 링크가 모두 같은 주소를 부른다.
  한 곳에 적어 두지 않으면 어디서 어긋나고, 그것을 누른 사람은 엉뚱한 곳에 선다.

  "내 여행"은 화면이 둘이 아니라 한 화면의 두 모습이다 — 지도와 목록. 목록은
  예전에 /trips 라는 따로 선 화면이었다. 같은 여행이 세 곳(지도 시트·목록·한장)에
  나뉘어 있어 이름이 겹쳤고, 지금은 /?v=sketch 한 곳에서 지도와 목록을 오간다.
  /trips 는 옛 주소를 위해 목록으로 넘겨 준다.
*/

/** 내 여행의 두 모습. */
export type MyView = "map" | "list";

/** 내 여행 — 지도. */
export const MAP_HREF = startHref("sketch");
/** 내 여행 — 목록. 모든 여행을 검색하고 거르고 지운다. */
export const LIST_HREF = `${MAP_HREF}&view=list`;
/** 한장 요약. */
export const SKETCH_HREF = "/sketch";
/** 사진을 골라 여행을 만드는 길. 어디서나 이 이름(사진 고르기)으로 부른다. */
export const ADD_HREF = "/trips/new";
/** 여행 100선. */
export const SPOTS_HREF = startHref("spots");

/**
 * 내 정보 — 가족 공유·가족 책장·보관함 정리·도움말·약관·로그아웃이 모인 곳.
 * 예전에는 위 띠의 이름을 눌러야 가족 공유가 열렸고, 책장은 그 맨 아래 링크로만 갈 수 있었다.
 */
export const ME_HREF = "/me";

/** 위 띠·하단 탭의 갈래. */
export type NavId = "trips" | "sketch" | "spots" | "me";

/** 주소의 ?view= 에서 모습을 읽는다. list 만 목록이고, 나머지는 지도. */
export function viewOf(value: string | null | undefined): MyView {
  return value === "list" ? "list" : "map";
}

/** 주소에 적을 내 여행의 모습. 보던 해가 있으면 함께. */
export function hubHref(view: MyView, year?: string): string {
  return `${MAP_HREF}${view === "list" ? "&view=list" : ""}${year ? `&y=${year}` : ""}`;
}

/** 앞부분만 닮은 주소("/sketchbook")를 같은 갈래로 치지 않는다. */
const under = (pathname: string, segment: string) => pathname === segment || pathname.startsWith(`${segment}/`);

/**
 * 지금 켜져 있는 갈래.
 *
 * 첫 화면("/")은 주소만으로 알 수 없다 — 내 여행과 여행 100선이 같은 주소를
 * 쓰고, 어느 쪽인지는 ?v= 와 지난번에 고른 것(쿠키)이 정한다. 부르는 쪽이 그
 * 갈래(start)를 넘겨 준다.
 */
export function activeNav(pathname: string, start: Start | null): NavId | null {
  if (pathname === "/") return start === "sketch" ? "trips" : start === "spots" ? "spots" : null;
  if (under(pathname, "/sketch")) return "sketch";
  if (under(pathname, "/trips") || under(pathname, "/places")) return "trips";
  if (["/spots", "/regions", "/course"].some((segment) => under(pathname, segment))) return "spots";
  // 내 정보와 그 한 칸인 가족 공유·가족 책장(부모님이 보는 /m 은 따로 — 거기엔 이 띠가 없다).
  if (["/me", "/family", "/mailboxes"].some((segment) => under(pathname, segment))) return "me";
  return null;
}

/**
 * 첫 화면("/")에서 지금 열린 갈래.
 *
 * 주소(?v=)가 먼저고, 없으면 지난번에 고른 것, 그것도 없으면 여행 100선 — app/page 가
 * 서버에서 고르는 규칙과 같다. 서버가 그린 첫 그림에서는 쿠키를 모르므로 "unknown"을
 * 받으면 모른다(null)고 답한다. 지난번에 고른 것은 로그인했을 수 있는 사람만 따른다 — 부르는 쪽이
 * 로그인하지 않았으면 null 로 걸러 넘긴다(보여 줄 것 없는 빈 지도 대신 환영 팝업이 뜨는 여행 100선을 여는 규칙).
 */
export function homeStart(fromUrl: string | null, remembered: Start | "unknown" | null): Start | null {
  if (fromUrl === "sketch" || fromUrl === "spots") return fromUrl;
  if (remembered === "unknown") return null;
  return remembered === "sketch" ? "sketch" : "spots";
}

/**
 * 폰 하단 탭을 보일 화면인가.
 *
 * 숨기는 곳:
 *   한장 요약   저장 막대(이미지 저장·링크 공유)가 그 자리를 쓴다.
 *               두 줄을 겹쳐 쌓으면 화면 아래 15% 가 단추로 덮인다.
 *   링크로 받은 화면(/s, /t)  받는 사람에게 "내 여행"은 없다.
 *   로그인 길   가려는 곳이 하나뿐이다.
 */
export function showsBottomNav(pathname: string): boolean {
  return !["/sketch", "/s", "/t", "/m", "/login", "/auth"].some((segment) => under(pathname, segment));
}

/**
 * 가족 책장의 받는 쪽(/m/…)인가. 부모님이 링크 하나로 들어오는 화면이라, 위 띠·하단 탭·처음 온
 * 사람 안내창을 모두 걷어 엽서와 답장 단추만 남긴다. 보내는 쪽(/mailboxes)은 평소 화면이다.
 */
export const isReceiverPath = (pathname: string): boolean => under(pathname, "/m");
