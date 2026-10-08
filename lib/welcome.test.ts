import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fromSearchEngine,
  markWelcomeShown,
  readWelcomeState,
  shouldShowWelcome,
  snoozeWelcomeToday,
  todayKey,
} from "./welcome";

/*
  로그인 전 첫 방문자에게 뜨는 환영 팝업의 규칙. 언제 내밀고 언제 그만 내미나가 전부다.

    - 이번 방문(탭을 연 동안)에는 한 번만. "나중에"는 이번 방문만 닫는다.
    - "오늘 그만 보기"는 오늘 하루(이 기기 시각)는 더 내밀지 않는다.
    - 검색 결과에서 바로 넘어온 사람에게는 이번 방문 내내 내밀지 않는다 — 막 도착한 사람의 화면을 가리는 팝업은
      구글이 순위에 불리하다고 안내해 둔 방식이고, 그분들은 100선을 보러 온 것이다.
    - 저장소를 쓸 수 없으면(사생활 보호 창 등) 내밀지 않는다 — 닫아도 기억하지 못해 올 때마다 뜨게 되기 때문이다.
*/

describe("todayKey · 이 기기 시각으로 오늘", () => {
  it("연-월-일 꼴이다", () => {
    expect(todayKey(new Date(2026, 9, 9, 13, 5))).toBe("2026-10-09");
  });

  it("한 자리 달·날은 0 을 채운다", () => {
    expect(todayKey(new Date(2027, 0, 3))).toBe("2027-01-03");
  });
});

describe("shouldShowWelcome", () => {
  const state = { snoozedOn: null as string | null, shownThisVisit: false, today: "2026-10-09" };

  it("처음 온 사람(아무 기록도 없다)에게는 내민다", () => {
    expect(shouldShowWelcome(state)).toBe(true);
  });

  it("이번 방문에 이미 내밀었으면 다시 내밀지 않는다 — 나중에를 눌렀거나 새로 고쳤을 때", () => {
    expect(shouldShowWelcome({ ...state, shownThisVisit: true })).toBe(false);
  });

  it("오늘 그만 보기를 누른 날에는 내밀지 않는다", () => {
    expect(shouldShowWelcome({ ...state, snoozedOn: "2026-10-09" })).toBe(false);
  });

  it("그만 본 날이 어제였으면 오늘은 다시 내민다", () => {
    expect(shouldShowWelcome({ ...state, snoozedOn: "2026-10-08" })).toBe(true);
  });

  it("저장소를 읽을 수 없으면(null) 내밀지 않는다 — 닫아도 기억하지 못해 올 때마다 뜬다", () => {
    expect(shouldShowWelcome(null)).toBe(false);
  });
});

describe("fromSearchEngine · 검색 결과에서 바로 넘어왔나", () => {
  it.each([
    "https://www.google.com/",
    "https://google.com/",
    "https://www.google.co.kr/",
    "https://www.google.com.au/",
    "https://search.naver.com/search.naver?query=%EC%A0%9C%EC%A3%BC",
    "https://m.search.naver.com/search.naver?query=x",
    "https://search.daum.net/search?q=x",
    "https://m.search.daum.net/search?w=tot&q=x",
    "https://www.bing.com/search?q=x",
    "https://duckduckgo.com/",
    "https://search.yahoo.com/search?p=x",
  ])("%s 는 검색", (referrer) => {
    expect(fromSearchEngine(referrer)).toBe(true);
  });

  it.each([
    "",
    "https://mail.google.com/mail/u/0/",
    "https://www.naver.com/",
    "https://blog.naver.com/someone/123",
    "https://cafe.naver.com/club",
    "https://www.youtube.com/watch?v=x",
    "https://yeohaeng-sesang.vercel.app/spots/경복궁",
    "https://google.evil.com/",
    "https://notgoogle.com/",
    "https://www.google.com.evil.com/",
    "not a url",
  ])("%s 는 검색이 아니다 — 카톡 링크·주소 직접 입력·메일·블로그·남의 사이트", (referrer) => {
    expect(fromSearchEngine(referrer)).toBe(false);
  });
});

describe("저장소에 기억하기", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("아무것도 안 눌렀으면 그만 본 날도, 이번 방문에 내민 적도 없다", () => {
    expect(readWelcomeState(new Date(2026, 9, 9))).toEqual({ snoozedOn: null, shownThisVisit: false, today: "2026-10-09" });
  });

  it("내밀었다고 적으면 이번 방문에는 다시 읽힌다 — 탭을 닫으면 사라진다(sessionStorage)", () => {
    markWelcomeShown();
    expect(readWelcomeState()?.shownThisVisit).toBe(true);
    expect(window.localStorage.getItem("welcome:shown")).toBeNull();
  });

  it("오늘 그만 보기는 오늘 날짜로 기억한다(localStorage) — 탭을 닫아도 남는다", () => {
    snoozeWelcomeToday(new Date(2026, 9, 9));
    expect(window.localStorage.getItem("welcome:snooze")).toBe("2026-10-09");
    window.sessionStorage.clear();
    expect(readWelcomeState(new Date(2026, 9, 9))?.snoozedOn).toBe("2026-10-09");
    // 날이 바뀌면 그만 본 날과 오늘이 달라져 다시 내밀게 된다.
    const tomorrow = readWelcomeState(new Date(2026, 9, 10))!;
    expect(shouldShowWelcome(tomorrow)).toBe(true);
  });

  it("저장소가 막혀 있으면 읽을 수 없다고 답하고, 쓰려 해도 터지지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("막힘");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("막힘");
    });
    expect(readWelcomeState()).toBeNull();
    expect(() => markWelcomeShown()).not.toThrow();
    expect(() => snoozeWelcomeToday()).not.toThrow();
  });
});
