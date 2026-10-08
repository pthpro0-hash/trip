import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hasSessionCookie, hasSessionCookieHere } from "./sessionCookie";

/*
  서버가 첫 화면을 그리기 전에 "로그인한 사람일 수도 있다"를 알아야, 로그인 전 사람에게는 처음부터 환영 영역을
  보이고 로그인한 사람에게는 자리만 비워 둘 수 있다(밀림·깜빡임 없이). 알아낼 길은 쿠키 이름뿐이다 — 값은 읽지 않는다.
*/
describe("hasSessionCookie · 로그인 세션 쿠키가 있나", () => {
  it("Supabase 가 세션을 담는 쿠키 이름이면 있다", () => {
    expect(hasSessionCookie(["sb-abcdefgh-auth-token"])).toBe(true);
  });

  it("세션이 길어 조각나면 이름 끝에 .0 .1 이 붙는다 — 그래도 있다", () => {
    expect(hasSessionCookie(["start", "sb-abcdefgh-auth-token.0", "sb-abcdefgh-auth-token.1"])).toBe(true);
  });

  it("로그인 중간에 잠깐 생기는 확인용 쿠키(code-verifier)는 세션이 아니다", () => {
    expect(hasSessionCookie(["sb-abcdefgh-auth-token-code-verifier"])).toBe(false);
  });

  it("다른 쿠키만 있으면 없다 — 첫 화면 갈래를 기억하는 start 도 아니다", () => {
    expect(hasSessionCookie(["start", "theme", "sb-abcdefgh"])).toBe(false);
  });

  it("쿠키가 하나도 없으면 없다", () => {
    expect(hasSessionCookie([])).toBe(false);
  });

  it("이름 가운데가 비어 있으면 세션이 아니다", () => {
    expect(hasSessionCookie(["sb--auth-token"])).toBe(false);
  });
});

/*
  브라우저에서도 같은 것을 본다. 위 띠·아래 탭이 "지금 첫 화면이 어느 갈래인가"를 가릴 때, 서버가 첫 화면을 여는
  규칙(로그인했을 수 있을 때만 지난번에 고른 갈래를 따른다)과 같아야 켜진 탭과 화면이 어긋나지 않는다.
*/
describe("hasSessionCookieHere · 이 브라우저에 로그인 세션 쿠키가 있나", () => {
  const clear = () => {
    document.cookie = "sb-abcdefgh-auth-token=; path=/; max-age=0";
    document.cookie = "sb-abcdefgh-auth-token.0=; path=/; max-age=0";
    document.cookie = "start=; path=/; max-age=0";
  };
  beforeEach(clear);
  afterEach(clear);

  it("쿠키가 없으면 없다", () => {
    expect(hasSessionCookieHere()).toBe(false);
  });

  it("세션 쿠키가 있으면 있다", () => {
    document.cookie = "sb-abcdefgh-auth-token=x; path=/";
    expect(hasSessionCookieHere()).toBe(true);
  });

  it("조각난 세션 쿠키도 있다고 본다", () => {
    document.cookie = "sb-abcdefgh-auth-token.0=x; path=/";
    expect(hasSessionCookieHere()).toBe(true);
  });

  it("갈래를 기억하는 start 쿠키만으로는 없다", () => {
    document.cookie = "start=sketch; path=/";
    expect(hasSessionCookieHere()).toBe(false);
  });
});
