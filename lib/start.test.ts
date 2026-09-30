import { describe, it, expect, beforeEach } from "vitest";
import { START_COOKIE, readStart, rememberStartIfUnset, startHref, startOf } from "./start";

describe("startOf", () => {
  it("아무것도 없으면 여행 100선 — 검색엔진이 보는 화면이다", () => {
    expect(startOf(undefined, undefined)).toBe("spots");
  });

  it("한 번 고른 갈래로 다음에도 연다", () => {
    expect(startOf(undefined, "sketch")).toBe("sketch");
  });

  it("주소에 적힌 갈래가 기억보다 앞선다 — 건네받은 링크는 건넨 사람의 화면이어야 한다", () => {
    expect(startOf("spots", "sketch")).toBe("spots");
    expect(startOf("sketch", "spots")).toBe("sketch");
  });

  it("엉뚱한 값은 없는 것으로 친다", () => {
    expect(startOf("해킹", "뭔가")).toBe("spots");
  });
});

describe("startHref", () => {
  it("갈래를 주소에 적는다", () => {
    expect(startHref("sketch")).toBe("/?v=sketch");
    expect(startHref("spots")).toBe("/?v=spots");
  });
});

const clearStart = () => {
  document.cookie = `${START_COOKIE}=; path=/; max-age=0`;
};

/*
  갈래를 누르지 않고도 "내 여행"으로 열려야 하는 사람이 있다 — 여행을 기록한
  사람. 그런데 눌러서 고른 사람의 선택을 뒤집으면 안 된다. 그래서 고른 적이
  있는지 읽을 수 있어야 한다.
*/
describe("readStart · 고른 적이 있는가", () => {
  beforeEach(clearStart);

  it("고른 적이 없으면 null", () => {
    expect(readStart()).toBeNull();
  });

  it("고른 갈래를 돌려준다", () => {
    document.cookie = "start=sketch; path=/";
    expect(readStart()).toBe("sketch");
    document.cookie = "start=spots; path=/";
    expect(readStart()).toBe("spots");
  });

  it("다른 쿠키 사이에 있어도 찾는다", () => {
    document.cookie = "a=1; path=/";
    document.cookie = "start=sketch; path=/";
    document.cookie = "b=2; path=/";
    expect(readStart()).toBe("sketch");
    document.cookie = "a=; path=/; max-age=0";
    document.cookie = "b=; path=/; max-age=0";
  });

  it("엉뚱한 값은 고른 적이 없는 것으로 친다", () => {
    document.cookie = "start=해킹; path=/";
    expect(readStart()).toBeNull();
  });

  it("이름만 닮은 쿠키는 아니다", () => {
    document.cookie = "restart=sketch; path=/";
    expect(readStart()).toBeNull();
    document.cookie = "restart=; path=/; max-age=0";
  });
});

describe("rememberStartIfUnset", () => {
  beforeEach(clearStart);

  it("고른 적이 없으면 기억한다", () => {
    rememberStartIfUnset("sketch");
    expect(readStart()).toBe("sketch");
  });

  it("이미 고른 사람의 선택은 뒤집지 않는다 — 100선을 골랐으면 그대로", () => {
    document.cookie = "start=spots; path=/";
    rememberStartIfUnset("sketch");
    expect(readStart()).toBe("spots");
  });

  it("같은 값이면 그대로 둔다", () => {
    document.cookie = "start=sketch; path=/";
    rememberStartIfUnset("sketch");
    expect(readStart()).toBe("sketch");
  });
});
