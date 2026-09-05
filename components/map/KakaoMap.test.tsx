import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { ScriptProps } from "next/script";
import { KakaoMap } from "./KakaoMap";

// next/script renders a real <script> tag and relies on browser load/error
// events that jsdom never fires, so we stub it to capture the props this
// component passes in (onReady/onError) and let tests invoke them directly.
let scriptProps: ScriptProps[] = [];

vi.mock("next/script", () => ({
  default: (props: ScriptProps) => {
    scriptProps.push(props);
    return null;
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  scriptProps = [];
});

describe("KakaoMap", () => {
  it("window.kakao가 없어도 컨테이너를 렌더링한다 (SSR/로딩 전 안전성)", () => {
    const { container } = render(<KakaoMap spots={[]} />);
    expect(container.querySelector("div")).toBeTruthy();
  });

  it("API 키가 없으면 안내 메시지를 표시한다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "");
    const { getByText } = render(<KakaoMap spots={[]} />);
    expect(getByText("지도를 보려면 카카오맵 키 설정이 필요합니다")).toBeTruthy();
  });

  it("스크립트 로딩 실패 후 재마운트해도 실패 안내가 onError 없이 즉시 표시된다", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_MAP_KEY", "remount-test-key");

    const { unmount } = render(<KakaoMap spots={[]} />);
    const firstMountProps = scriptProps.at(-1);
    expect(firstMountProps?.onError).toBeTypeOf("function");

    // Simulate next/script's onError firing on the first mount.
    act(() => {
      firstMountProps?.onError?.(new Event("error"));
    });
    expect(screen.getByText("지도를 불러오지 못했습니다")).toBeTruthy();

    // Unmount and mount a brand-new instance without ever calling onError
    // again. next/script's own cache would replay onLoad here (the bug this
    // fix addresses), so the fallback must appear purely from the module
    // scope failure tracking, not from another onError call.
    unmount();
    scriptProps = [];

    render(<KakaoMap spots={[]} />);
    expect(screen.getByText("지도를 불러오지 못했습니다")).toBeTruthy();
  });
});
