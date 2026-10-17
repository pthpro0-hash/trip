import { describe, it, expect } from "vitest";
import sitemap, { BASE_URL } from "./sitemap";

describe("sitemap", () => {
  it("예시 여행 페이지가 들어 있다 — 로그인 없이 볼 수 있는 소개다", () => {
    expect(sitemap().map((entry) => entry.url)).toContain(`${BASE_URL}/example`);
  });
});
