// @vitest-environment node
import { describe, it, expect } from "vitest";
import { AUTH_PROVIDERS, providerById } from "./providers";

describe("AUTH_PROVIDERS", () => {
  it("국내 사용자에게 익숙한 순서로 둔다 — 카카오가 맨 앞", () => {
    expect(AUTH_PROVIDERS[0].id).toBe("kakao");
  });

  it("같은 수단이 두 번 들어가지 않는다", () => {
    const ids = AUTH_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모두 이름과 색을 갖는다", () => {
    for (const provider of AUTH_PROVIDERS) {
      expect(provider.label.length).toBeGreaterThan(0);
      expect(provider.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(provider.foreground).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("흰 버튼에는 테두리가 있다 — 없으면 밝은 배경에서 사라진다", () => {
    for (const provider of AUTH_PROVIDERS) {
      if (provider.background.toLowerCase() === "#ffffff") {
        expect(provider.border).toBeTruthy();
      }
    }
  });
});

describe("providerById", () => {
  it("아는 수단을 찾아준다", () => {
    expect(providerById("google")?.label).toBe("Google로 시작하기");
  });

  it("모르는 수단은 undefined", () => {
    expect(providerById("naver")).toBeUndefined();
  });
});
