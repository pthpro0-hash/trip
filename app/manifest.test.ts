// @vitest-environment node
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import manifest from "./manifest";

/*
  홈 화면에 추가했을 때 앱처럼 뜨려면 매니페스트가 있어야 한다. 아이콘 파일이 실제로 있어야
  하고(없으면 설치 안내가 안 뜬다), 열리는 곳은 로그인한 사람이 바로 쓰는 "내 여행"이다.
*/
describe("manifest", () => {
  const m = manifest();

  it("앱 이름과 전체 화면 실행", () => {
    expect(m.name).toBe("내 여행 스케치");
    expect(m.short_name!.length).toBeLessThanOrEqual(12);
    expect(m.display).toBe("standalone");
    expect(m.lang).toBe("ko");
  });

  it("홈 화면에서 열면 내 여행(지도)으로 들어간다", () => {
    expect(m.start_url).toBe("/?v=sketch");
    expect(m.scope).toBe("/");
  });

  it("설치에 필요한 크기(192·512)와 maskable 아이콘이 있고 파일이 실제로 있다", () => {
    const sizes = m.icons!.map((icon) => `${icon.sizes}:${icon.purpose ?? "any"}`);
    expect(sizes).toContain("192x192:any");
    expect(sizes).toContain("512x512:any");
    expect(sizes).toContain("512x512:maskable");
    for (const icon of m.icons!) {
      expect(existsSync(join(process.cwd(), "public", icon.src)), icon.src).toBe(true);
    }
  });

  it("바탕색과 주제색이 있다 — 켜질 때 흰 화면이 번쩍이지 않게", () => {
    expect(m.background_color).toMatch(/^#/);
    expect(m.theme_color).toMatch(/^#/);
  });
});
