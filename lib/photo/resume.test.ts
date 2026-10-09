import { describe, it, expect } from "vitest";
import { RESUME_LOGIN_HREF, resumeRequested } from "./resume";

/*
  맡겨 둔 여행은 '우리가 로그인으로 보냈다가 돌아온 때'에만 되살린다. 그 표시가 로그인을 거쳐 돌아오는 길(login 화면 → 카카오 등 →
  app/auth/callback → 사진으로 여행 추가)을 어떻게 지나가는지 본다.
*/
describe("resume · 로그인하러 갔다 돌아왔다는 표시", () => {
  it("로그인으로 가는 주소는 마치고 돌아올 곳('사진으로 여행 추가')에 표시를 붙인다", () => {
    expect(RESUME_LOGIN_HREF).toBe("/login?next=%2Ftrips%2Fnew%3Fresume%3D1");
  });

  it("로그인 화면이 next 를 한 번 풀어 돌려주면 돌아올 주소에 표시가 쿼리로 남는다", () => {
    const next = new URL(RESUME_LOGIN_HREF, "https://example.test").searchParams.get("next")!;
    expect(next).toBe("/trips/new?resume=1");
    expect(resumeRequested(new URL(next, "https://example.test").search)).toBe(true);
  });

  it("표시가 있을 때만 참이다", () => {
    expect(resumeRequested("?resume=1")).toBe(true);
    expect(resumeRequested("?from=x&resume=1")).toBe(true);
    expect(resumeRequested("")).toBe(false);
    expect(resumeRequested("?resume=0")).toBe(false);
    expect(resumeRequested("?resume=1x")).toBe(false);
    expect(resumeRequested("?other=1")).toBe(false);
  });
});
