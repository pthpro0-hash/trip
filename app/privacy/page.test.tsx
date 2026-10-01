import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PrivacyPage from "./page";
import TermsPage from "../terms/page";

/*
  가족 공유는 남에게 내 기록 전체를 여는 일이다. 무엇이 보이는지, 언제 끊기는지, 무엇이
  남는지를 방침과 약관이 말하고 있어야 한다.
*/
describe("개인정보처리방침 · 가족 공유", () => {
  const text = () => render(<PrivacyPage />).container.textContent ?? "";

  it("무엇이 모이는지에 가족 연결이 있다", () => {
    expect(text()).toContain("가족 공유를 쓰실 때");
  });

  it("가족이 무엇을 볼 수 있는지 숨김없이 적는다 — 가리지 않은 기록 전체", () => {
    const t = text();
    expect(t).toContain("이용자의 여행 기록 전체");
    expect(t).toContain("가리지 않은 기록 그대로");
    expect(t).toContain("서로의 이메일");
    expect(t).toContain("8명");
  });

  it("끊으면 즉시 접근이 끊기고, 가족이 올린 것은 남는다고 적는다", () => {
    const t = text();
    expect(t).toContain("그 즉시 접근이 끊깁니다");
    expect(t).toContain("가족이 올려 쌓인 사진과 여행은 이용자의 기록");
  });
});

describe("시행일", () => {
  it("방침과 약관 모두 시행일이 적혀 있고, 빈칸 안내가 남아 있지 않다", () => {
    for (const Page of [PrivacyPage, TermsPage]) {
      const t = render(<Page />).container.textContent ?? "";
      expect(t).toContain("시행일 2026년 10월 1일");
      expect(t).not.toContain("정해 적어주세요");
    }
  });
});

describe("이용약관 · 가족 공유", () => {
  it("권한을 주는 것은 초대한 회원이 정하고, 그 범위의 일은 운영자가 책임지지 않는다", () => {
    const t = render(<TermsPage />).container.textContent ?? "";
    expect(t).toContain("가족 공유");
    expect(t).toContain("초대한 회원이 정하며");
  });
});
