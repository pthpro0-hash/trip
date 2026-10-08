/*
  로그인 전 첫 방문자에게 뜨는 환영 팝업의 규칙(components/home/WelcomeDialog).

  언제 내밀고 언제 그만 내미나:
    - 이번 방문(탭을 연 동안)에는 한 번만. "나중에"·✕·바깥·Esc 는 이번 방문만 닫는다 — 다음에 새로 열면 또 뜬다.
    - "오늘 그만 보기"를 누르면 오늘 하루(이 기기 시각)는 더 내밀지 않는다.
    - 검색 결과에서 바로 넘어온 사람에게는 이번 방문 내내 내밀지 않는다. 막 도착한 사람의 화면을 가리는 팝업은 구글이
      검색 순위에 불리하다고 안내해 둔 방식이고, 그분들은 여행 100선을 보러 온 것이라 방해가 되기 쉽다. 주소를 직접
      열었거나 카톡 링크·홈 화면 아이콘으로 온 사람에게는 뜬다.
    - 저장소를 쓸 수 없으면(사생활 보호 창 등) 내밀지 않는다. 닫아도 기억하지 못해 올 때마다 뜨게 되기 때문이다.

  이 기억은 브라우저에만 둔다. 계정에 남겨 둘 만큼 중요한 사실이 아니다.
*/

const SNOOZE_KEY = "welcome:snooze";
const SHOWN_KEY = "welcome:shown";

/** 이 기기 시각으로 오늘. "2026-10-09" */
export function todayKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface WelcomeState {
  /** "오늘 그만 보기"를 누른 날. */
  snoozedOn: string | null;
  /** 이번 방문(탭을 연 동안)에 이미 내밀었는가. */
  shownThisVisit: boolean;
  today: string;
}

/** null 은 저장소를 읽을 수 없다는 뜻이다 — 그때는 내밀지 않는다. */
export function shouldShowWelcome(state: WelcomeState | null): boolean {
  if (!state) return false;
  return state.snoozedOn !== state.today && !state.shownThisVisit;
}

/**
 * 검색 결과에서 바로 넘어왔나. 알려진 검색 사이트의 검색 주소만 센다 — 메일(mail.google.com)·블로그·카페·남의
 * 사이트에서 온 사람은 검색에서 온 것이 아니다. 호스트를 정확히 맞춘다(google.evil.com 같은 이름에 속지 않게).
 */
const SEARCH_HOSTS: RegExp[] = [
  /^(www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$/,
  /^(m\.)?search\.naver\.com$/,
  /^(m\.)?search\.daum\.net$/,
  /^(www\.)?bing\.com$/,
  /^(www\.)?duckduckgo\.com$/,
  /^search\.yahoo\.com$/,
];

export function fromSearchEngine(referrer: string): boolean {
  if (!referrer) return false;
  try {
    const { hostname } = new URL(referrer);
    return SEARCH_HOSTS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}

/* 저장소가 막혀 있어도(사생활 보호 창 등) 앱은 멈추지 않는다 — 안내를 안 띄울 뿐이다. */

/** 지금 기억을 읽는다. 저장소를 읽을 수 없으면 null. */
export function readWelcomeState(now: Date = new Date()): WelcomeState | null {
  try {
    return {
      snoozedOn: window.localStorage.getItem(SNOOZE_KEY),
      shownThisVisit: window.sessionStorage.getItem(SHOWN_KEY) === "1",
      today: todayKey(now),
    };
  } catch {
    return null;
  }
}

/** 이번 방문에 내밀었다(또는 내밀지 않기로 했다)고 적는다. 탭을 닫으면 사라진다. */
export function markWelcomeShown(): void {
  try {
    window.sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // 적지 못하면 다음 새로 고침에 한 번 더 보일 뿐이다.
  }
}

/** "오늘 그만 보기". 오늘 날짜를 적어 둔다. */
export function snoozeWelcomeToday(now: Date = new Date()): void {
  try {
    window.localStorage.setItem(SNOOZE_KEY, todayKey(now));
  } catch {
    // 적지 못하면 다음에 한 번 더 보일 뿐이다.
  }
}
