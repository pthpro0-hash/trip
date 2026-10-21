/*
  첫 방문 인트로(components/home/IntroScreen)가 뜨는 규칙.

  이 기기에서 딱 한 번만 뜬다. 한 번 보이면(건너뛰어도, 시작해도) 다시는 안 뜬다 — 다음 방문부터는 환영 팝업(lib/welcome)의
  규칙을 따른다. 검색에서 바로 넘어온 사람(막 도착한 화면을 가리지 않는다)과 로그인한 사람(이미 아는 사람)에게는 내밀지
  않는다. 저장소를 쓸 수 없으면(사생활 보호 창 등) 내밀지 않는다 — 기억하지 못해 올 때마다 뜨게 된다.
*/

const SEEN_KEY = "intro:seen";

/** 이 기기에서 이미 봤는가. null 은 저장소를 읽을 수 없다는 뜻이다. */
export function readIntroSeen(): boolean | null {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return null;
  }
}

export function markIntroSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // 적지 못하면 다음에 한 번 더 보일 뿐이다.
  }
}

export function shouldShowIntro(input: { seen: boolean | null; fromSearch: boolean; hasSession: boolean }): boolean {
  return input.seen === false && !input.fromSearch && !input.hasSession;
}
