import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KakaoMap } from "./KakaoMap";

describe("KakaoMap", () => {
  it("window.kakao가 없어도 컨테이너를 렌더링한다 (SSR/로딩 전 안전성)", () => {
    const { container } = render(<KakaoMap spots={[]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("API 키가 없으면 안내 메시지를 표시한다", () => {
    const { getByText } = render(<KakaoMap spots={[]} />);
    expect(getByText("지도를 보려면 카카오맵 키 설정이 필요합니다")).toBeTruthy();
  });
});
