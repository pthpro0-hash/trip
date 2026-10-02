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

describe("개인정보처리방침 · 가족 우편함", () => {
  const text = () => render(<PrivacyPage />).container.textContent ?? "";

  it("무엇이 모이는지에 우편함·엽서·답장이 있다", () => {
    const t = text();
    expect(t).toContain("가족 우편함을 쓰실 때");
    expect(t).toContain("받는 분의 답장");
  });

  it("엽서를 링크를 아는 누구나 볼 수 있다는 것과 무엇이 실리고 안 실리는지를 적는다", () => {
    const t = text();
    expect(t).toContain("엽서를 받는 분은 로그인하지 않으며");
    expect(t).toContain("링크를 아는 누구나");
    expect(t).toContain("메모와 함께한 사람의 이름은 싣지 않고");
    expect(t).toContain("약 1km");
  });

  it("받는 분에게서는 계정 정보를 받지 않는다고 적는다", () => {
    expect(text()).toContain("받는 분의 이메일·전화번호는 받지 않습니다");
  });

  it("지우면 복사본도 지워지고, 받는 분이 이미 저장한 것은 지울 수 없다고 적는다", () => {
    const t = text();
    expect(t).toContain("원본 사진을 지우면 엽서의 복사본도 함께 지워지고");
    expect(t).toContain("받는 분이 자기 폰에 저장한 사진은 지울 수 없습니다");
    expect(t).toContain("링크를 새로 만들면 옛 링크는 바로 열리지 않습니다");
  });

  it("메신저가 미리보기를 위해 첫 사진과 인사말 한 줄을 읽어 갈 수 있다고 적는다", () => {
    expect(text()).toContain("미리보기");
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

describe("이용약관 · 가족 우편함", () => {
  const text = () => render(<TermsPage />).container.textContent ?? "";

  it("엽서를 보내는 회원이 받는 분과 내용에 책임을 진다", () => {
    const t = text();
    expect(t).toContain("가족 우편함");
    expect(t).toContain("엽서에 담는 사진·글에 대한 책임은 보내는 회원에게 있고");
  });

  it("링크가 퍼진 것에 대한 운영자의 책임 한계를 적는다", () => {
    expect(text()).toContain("링크를 받은 사람이 다른 사람에게 전달한 것");
  });

  it("원하지 않는 사람에게 반복해서 엽서를 보내는 것을 금지한다", () => {
    expect(text()).toContain("원하지 않는 사람에게 엽서를 반복해서 보내는 행위");
  });
});

describe("이용약관 · 가족 공유", () => {
  it("권한을 주는 것은 초대한 회원이 정하고, 그 범위의 일은 운영자가 책임지지 않는다", () => {
    const t = render(<TermsPage />).container.textContent ?? "";
    expect(t).toContain("가족 공유");
    expect(t).toContain("초대한 회원이 정하며");
  });
});
