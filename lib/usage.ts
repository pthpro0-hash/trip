import { getBrowserClient } from "@/lib/supabase/client";
import { logEvent } from "@/lib/supabase/serviceLog";
import { homeStart } from "@/lib/nav";
import type { Start } from "@/lib/start";

/*
  어떤 화면을 열고 어떤 기능을 썼는지 센다.

  기능이 많아져 처음 쓰는 사람에게 복잡해 보인다. 무엇을 앞에 두고 무엇을 숨기거나 뺄지를 감이 아니라
  쓰인 횟수로 정하려고 센다. 남기는 것은 이름 하나뿐이다 — 어느 여행·곳·사진인지, 무엇을 적었는지는
  싣지 않는다(serviceLog 와 같은 원칙, 한 달이 지나면 지워진다).

  로그인한 사람만 센다. 개인정보처리방침이 "로그인하지 않고 둘러보실 때는 아무것도 모으지 않습니다"라고
  약속한다.

  기록은 service_log 에 "use.<이름>" 으로 쌓인다. 보는 법은 supabase/log.sql 아래쪽에 적어 두었다.

  아직 꺼 두었다. 방침은 이용 내역을 "무엇이 고장 났는지 확인하는 데에만" 쓴다고 약속하고, 방침을 바꿀 때는
  시행 7일 전부터 화면에 알린다고 약속한다. 방침 문구를 바꾸고 알린 뒤, 시행일을 USAGE_STARTS 에 적으면 그날부터 센다.
*/

/** 세기 시작하는 날("YYYY-MM-DD", 한국 날짜). null 이면 세지 않는다. */
export const USAGE_STARTS: string | null = null;

/** 그날이 되었는가. 한국 날짜로 견준다. */
export function usageOn(starts: string | null, now: Date = new Date()): boolean {
  if (!starts) return false;
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  return today >= starts;
}

/** 연 화면. 주소마다 하나(여행·곳마다 다른 주소는 한 이름으로 묶는다). */
export const SCREENS = [
  "my_map",
  "my_list",
  "spots_home",
  "sketch",
  "add_photos",
  "trip_detail",
  "places",
  "spot_detail",
  "region",
  "course",
  "me",
  "family",
  "mailboxes",
  "help",
] as const;
export type UsageScreen = (typeof SCREENS)[number];

/** 화면 안에서 쓴 기능. 화면을 연 것만으로는 알 수 없는 것들. */
export const ACTIONS = [
  // 한장 요약
  "sketch_save",
  "sketch_share",
  "sketch_shape",
  "sketch_line",
  "sketch_all_tab",
  "sketch_to_map",
  "footprint_play",
  // 내 여행 지도
  "hub_period",
  "hub_sido",
  "hub_curated",
  "hub_abroad",
  "hub_echo",
  // 여행 상세
  "trip_share",
  "postcard_sent",
  // 여행 100선
  "spot_suggest",
  // 내 정보
  "abroad_rename",
  "storage_cleanup",
] as const;
export type UsageAction = (typeof ACTIONS)[number];

export type UsageName = UsageScreen | UsageAction;

/** 이 하나만 남긴다. 절대 던지지 않고, 기다리게 하지도 않는다. 로그인하지 않았으면 남기지 않는다. */
export function logUse(name: UsageName, starts: string | null = USAGE_STARTS, now: Date = new Date()): void {
  if (!usageOn(starts, now)) return;
  try {
    // 로그인했는지는 logEvent 가 본다.
    logEvent(getBrowserClient(), `use.${name}`);
  } catch {
    // 세지 못한 것뿐이다.
  }
}

const under = (pathname: string, segment: string) => pathname === segment || pathname.startsWith(`${segment}/`);

/**
 * 주소로 어느 화면인지. 셀 화면이 아니면 null(링크로 받은 화면·로그인 길·관리 화면 등).
 *
 * 첫 화면("/")은 내 여행과 여행 100선이 함께 쓴다 — ?v= 가 먼저고, 없으면 지난번에 고른 것(remembered).
 */
export function screenOf(
  pathname: string,
  params: { v: string | null; view: string | null },
  remembered: Start | null,
): UsageScreen | null {
  if (pathname === "/") {
    const start = homeStart(params.v, remembered);
    if (start === "sketch") return params.view === "list" ? "my_list" : "my_map";
    return "spots_home";
  }
  if (pathname === "/trips/new") return "add_photos";
  if (pathname === "/trips") return "my_list";
  if (under(pathname, "/trips")) return "trip_detail";
  if (under(pathname, "/sketch")) return "sketch";
  if (under(pathname, "/places")) return "places";
  if (under(pathname, "/spots")) return "spot_detail";
  if (under(pathname, "/regions")) return "region";
  if (under(pathname, "/course")) return "course";
  if (under(pathname, "/mailboxes")) return "mailboxes";
  if (under(pathname, "/family")) return "family";
  if (under(pathname, "/me")) return "me";
  if (under(pathname, "/help")) return "help";
  return null;
}
