import { describe, it, expect, vi } from "vitest";

// 레이아웃이 끌어오는 화면 조각은 이 시험과 상관없다(소개 문구만 본다).
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));
vi.mock("@/components/auth/CollectionSync", () => ({ CollectionSync: () => null }));
vi.mock("@/components/layout/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/layout/RegisterServiceWorker", () => ({ RegisterServiceWorker: () => null }));
vi.mock("@/components/family/FamilyBanner", () => ({ FamilyBanner: () => null }));
vi.mock("@/components/layout/BottomNav", () => ({ BottomNav: () => null, BottomNavSpace: () => null }));
vi.mock("@/components/photo/PhotoLauncher", () => ({ PhotoLauncher: () => null }));
vi.mock("@/components/layout/UsageTracker", () => ({ UsageTracker: () => null }));
const { metadata } = await import("./layout");

/*
  검색 결과와 링크 미리보기에 나오는 소개. 환영 안내와 같은 약속("사진으로 남기는 내 여행")을 앞세우고, 갈 곳 찾기(한국관광 100선)는
  그 곁의 도구로 말한다.
*/
describe("사이트 소개 문구", () => {
  it("제목이 사진으로 남기는 내 여행이다 — 100선 추천이 아니다", () => {
    const title = (metadata.title as { default: string }).default;
    expect(title).toBe("내 여행 스케치 | 사진으로 남기는 내 여행");
    expect(title).not.toContain("추천");
  });

  it("설명이 핵심 기능(사진 → 날짜·장소 → 지도·한 장 카드)을 먼저 말하고, 한국관광 100선은 갈 곳 찾기로 잇는다", () => {
    const description = String(metadata.description);
    expect(description.indexOf("사진만 고르면")).toBe(0);
    expect(description).toContain("지도와 한 장 카드");
    expect(description).toContain("한국관광 100선");
    expect(description.indexOf("지도와 한 장 카드")).toBeLessThan(description.indexOf("한국관광 100선"));
  });

  it("링크 미리보기(OG)도 같은 소개다", () => {
    expect(metadata.openGraph?.title).toBe("내 여행 스케치 | 사진으로 남기는 내 여행");
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });
});
