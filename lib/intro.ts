/*
  첫 방문 소개(components/home/IntroScreen)가 뜨는 규칙.

  로그인 전이면 방문할 때마다 뜬다. 한 방문(탭을 연 동안) 안에서 앱 안의 이동으로 첫 화면에 돌아올 때는 다시 뜨지 않는다 —
  로고를 누를 때마다 가리면 방해다. 새로 열면(탭을 닫았다 열기, 홈 화면 아이콘으로 다시 열기) 다시 뜬다. 로그인한 사람
  (이미 아는 사람)에게는 안 뜬다.

  환영 팝업(예전 WelcomeDialog)은 이 소개가 같은 말을 하게 되어 없앴다. 소개가 뜨는 데 검색에서 넘어왔는지, 이 기기에서 봤는지는
  따지지 않는다.
*/

import { hasSessionCookieHere } from "./sessionCookie";

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

/*
  빨리 뜨게 하기.

  예전에는 화면의 자바스크립트(여행 100선 121곳, 지도 등)가 다 받아지고 붙은 뒤에야 소개를 띄웠다. 폰에서는 몇 초 동안 100선이
  보이다가 소개가 뒤늦게 덮었다. 이제 서버가 소개를 처음부터 그려 보내고(로그인 쿠키가 없을 때만, app/page), 그 바로 앞에 둔 아주
  작은 글(INTRO_BOOT_SCRIPT)이 화면이 그려지기 전에 "이번 방문에 이미 봤나"를 보고 <html data-intro="on|off"> 를 적는다. off 면
  globals.css 가 소개를 감춘다 — 그래서 이미 본 사람에게 소개가 번쩍이지도 않는다.

  앱 안에서 첫 화면으로 돌아온 경우에는 그 글이 다시 돌지 않는다. 그때는 introOpen 이 같은 판단을 해서 적는다. 닫으면 off 로 적어
  같은 방문 안에서는 다시 열리지 않는다.
*/

const INTRO_ATTR = "data-intro";
const INTRO_EVENT = "intro-change";

/** 화면이 그려지기 전에 도는 글. 위 함수들과 같은 규칙(로그인 쿠키 · 이번 방문에 봤나)을 문자열로 둔다. */
export const INTRO_BOOT_SCRIPT = `(function(){var d=document.documentElement;try{if(/(^|;\\s*)sb-[^=]+-auth-token(\\.\\d+)?=/.test(document.cookie)||sessionStorage.getItem("${SHOWN_KEY}")==="1"){d.setAttribute("${INTRO_ATTR}","off");return}sessionStorage.setItem("${SHOWN_KEY}","1")}catch(e){}d.setAttribute("${INTRO_ATTR}","on")})();`;

/** 지금 소개를 보여야 하나. 아직 아무도 정하지 않았으면(앱 안에서 넘어왔다) 여기서 정하고 적는다. */
export function introOpen(): boolean {
  const root = document.documentElement;
  if (!root.hasAttribute(INTRO_ATTR)) {
    const show = shouldShowIntro({ shown: readIntroShown(), hasSession: hasSessionCookieHere() });
    if (show) markIntroShown();
    root.setAttribute(INTRO_ATTR, show ? "on" : "off");
  }
  return root.getAttribute(INTRO_ATTR) === "on";
}

/**
 * 지금 소개가 화면을 덮고 있나 — 읽기만 한다(정하지 않는다). 첫 화면의 지도처럼 가려진 동안에는 무거운 것을 미뤄 두는 데 쓴다.
 * 소개가 없는 화면·로그인한 사람에게는 늘 false.
 */
export function introCovering(): boolean {
  return document.documentElement.getAttribute(INTRO_ATTR) === "on";
}

/** 소개를 닫는다. 같은 방문 안에서는 다시 열리지 않는다. */
export function closeIntro(): void {
  document.documentElement.setAttribute(INTRO_ATTR, "off");
  window.dispatchEvent(new Event(INTRO_EVENT));
}

export function subscribeIntro(onChange: () => void): () => void {
  window.addEventListener(INTRO_EVENT, onChange);
  return () => window.removeEventListener(INTRO_EVENT, onChange);
}

/** 시험에서 정해 둔 것을 지운다. */
export function resetIntroForTest(): void {
  shownInMemory = false;
  document.documentElement.removeAttribute(INTRO_ATTR);
}
