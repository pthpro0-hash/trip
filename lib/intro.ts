/*
  첫 방문 소개(components/home/IntroScreen)가 뜨는 규칙.

  로그인 전이면 방문할 때마다 뜬다. 한 방문(탭을 연 동안) 안에서 앱 안의 이동으로 첫 화면에 돌아올 때는 다시 뜨지 않는다 —
  로고를 누를 때마다 가리면 방해다. 새로 열면(탭을 닫았다 열기, 홈 화면 아이콘으로 다시 열기) 다시 뜬다. 로그인한 사람
  (이미 아는 사람)에게는 안 뜬다.

  환영 팝업(예전 WelcomeDialog)은 이 소개가 같은 말을 하게 되어 없앴다. 소개가 뜨는 데 검색에서 넘어왔는지, 이 기기에서 봤는지는
  따지지 않는다.
*/

const SHOWN_KEY = "intro:shown";

/** 저장소를 못 쓸 때(사생활 보호 창 등)에는 이 값이 방문의 기억을 대신한다. */
let shownInMemory = false;

/** 이번 방문에 이미 보였는가. */
export function readIntroShown(): boolean {
  if (shownInMemory) return true;
  try {
    return window.sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markIntroShown(): void {
  shownInMemory = true;
  try {
    window.sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // 적지 못해도 위 변수가 이 탭 안에서는 기억한다.
  }
}

/** 시험에서 방문의 기억을 비운다. */
export function resetIntroShownForTest(): void {
  shownInMemory = false;
}

export function shouldShowIntro(input: { shown: boolean; hasSession: boolean }): boolean {
  return !input.shown && !input.hasSession;
}
