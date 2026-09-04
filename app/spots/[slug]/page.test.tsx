import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SpotDetailPage from "./page";

// SpotDetailPage is an async Server Component (`async function` taking
// `{ params: Promise<{ slug: string }> }`). It contains no server-only APIs
// (no cookies/headers/fetch), so it can be awaited directly like a plain
// async function and the resulting JSX rendered with Testing Library.
describe("SpotDetailPage", () => {
  it("유효한 한글 slug는 해당 관광지 정보를 렌더링한다", async () => {
    const jsx = await SpotDetailPage({ params: Promise.resolve({ slug: encodeURIComponent("경복궁") }) });
    render(jsx);
    expect(screen.getByRole("heading", { level: 1, name: "경복궁" })).toBeTruthy();
  });

  it("존재하지 않는 slug는 notFound()로 처리된다", async () => {
    await expect(
      SpotDetailPage({ params: Promise.resolve({ slug: "이런-곳은-없음" }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });

  it("잘못된 퍼센트 인코딩 slug는 URIError를 던지지 않고 notFound()로 처리된다", async () => {
    await expect(
      SpotDetailPage({ params: Promise.resolve({ slug: "%" }) }),
    ).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404") });
  });
});
