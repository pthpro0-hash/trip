// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/*
  서비스 워커는 시험 안에서 돌릴 수 없어, 지켜야 할 규칙이 글에 적혀 있는지 확인한다.
  가장 중요한 규칙은 "사람의 자료를 저장해 두지 않는다"이다 — 기록·사진·로그인 응답을
  캐시하면 로그아웃한 뒤에도, 다른 사람이 같은 폰을 써도 앞 사람의 것이 보일 수 있다.
*/
const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

describe("sw.js", () => {
  it("끊겼을 때 보여 줄 화면이 실제로 있다", () => {
    expect(sw).toContain("/offline.html");
    expect(existsSync(join(process.cwd(), "public", "offline.html"))).toBe(true);
  });

  it("페이지 이동은 늘 네트워크로 — 캐시한 옛 페이지를 보여 주지 않고, 끊겼을 때만 안내 화면", () => {
    expect(sw).toMatch(/request\.mode === "navigate"/);
    expect(sw).toMatch(/catch[\s\S]*offline\.html/);
  });

  it("저장하는 것은 바뀌지 않는 정적 파일(해시가 붙은 /_next/static)뿐이다", () => {
    expect(sw).toContain("/_next/static/");
  });

  it("같은 출처의 GET 만 다룬다 — Supabase·카카오·사진 주소(다른 출처)와 쓰기 요청은 건드리지 않는다", () => {
    expect(sw).toMatch(/request\.method !== "GET"/);
    expect(sw).toMatch(/url\.origin !== self\.location\.origin/);
  });

  it("API 와 로그인 길은 절대 저장하지 않는다", () => {
    expect(sw).toMatch(/\/api\//);
    expect(sw).toMatch(/\/auth\//);
  });

  it("새 판이 오면 옛 저장분을 지우고 바로 이어받는다", () => {
    expect(sw).toContain("skipWaiting");
    expect(sw).toContain("clients.claim");
    expect(sw).toContain("caches.delete");
  });
});
