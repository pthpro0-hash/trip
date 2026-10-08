/*
  로그인한 사람일 수도 있는지를 쿠키 이름만으로 알아본다.

  첫 화면은 서버가 먼저 그린다. 로그인 전 사람에게는 환영 영역을 처음부터 보이고, 로그인한 사람에게는 자리만
  비워 두었다가 그 사람의 형편(여행이 있나 없나)이 알려지면 채운다 — 그래야 화면이 번쩍이거나 아래 내용이
  밀리지 않는다. 로그인을 정말 확인하려면 Supabase 에 물어야 하는데, 그것은 브라우저가 이미 하고 있다(HomeIntro).
  여기서는 물을 필요 없이 "쿠키가 있나"만 본다. 값은 읽지 않는다.

  Supabase 가 세션을 담는 쿠키는 sb-<프로젝트>-auth-token 이고, 세션이 길면 .0 .1 로 조각난다. 로그인 도중에
  잠깐 생기는 sb-…-auth-token-code-verifier 는 세션이 아니다.
*/

const SESSION = /^sb-.+-auth-token(\.\d+)?$/;

export const hasSessionCookie = (names: string[]): boolean => names.some((name) => SESSION.test(name));

/**
 * 이 브라우저에 로그인 세션 쿠키가 있나. 위 띠·아래 탭이 "지금 첫 화면이 어느 갈래인가"를 가릴 때 쓴다 —
 * 서버가 첫 화면을 여는 규칙(app/page)과 같아야 켜진 탭과 화면이 어긋나지 않는다. 세션 쿠키는 브라우저가
 * 읽을 수 있게 둔 것이라(httpOnly 가 아니다) 이름을 볼 수 있다.
 */
export function hasSessionCookieHere(): boolean {
  try {
    return hasSessionCookie(document.cookie.split(";").map((part) => part.trim().split("=")[0]));
  } catch {
    return false;
  }
}
