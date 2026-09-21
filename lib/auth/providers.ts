/** 우리가 쓸 수 있는 로그인 수단. 배열 순서가 곧 화면에 나오는 순서다. */
export type ProviderId = "kakao" | "google" | "github";

export interface AuthProvider {
  id: ProviderId;
  label: string;
  /** 브랜드 색은 남의 것이라 테마 토큰을 쓰지 않는다. 다크 모드에서도 그대로 둔다. */
  background: string;
  foreground: string;
  border?: string;
}

/*
  카카오를 맨 앞에 둔다 — 국내 사용자에게 가장 익숙하다.
  구글이 그다음, GitHub은 개발 중 확인용이라 맨 뒤다.
*/
export const AUTH_PROVIDERS: AuthProvider[] = [
  { id: "kakao", label: "카카오로 시작하기", background: "#FEE500", foreground: "#191600" },
  {
    id: "google",
    label: "Google로 시작하기",
    background: "#ffffff",
    foreground: "#1f1f1f",
    // 흰 버튼이라 테두리가 없으면 밝은 배경에서 사라진다. 구글 가이드라인이기도 하다.
    border: "#dadce0",
  },
  { id: "github", label: "GitHub으로 시작하기", background: "#24292f", foreground: "#ffffff" },
];

export function providerById(id: string): AuthProvider | undefined {
  return AUTH_PROVIDERS.find((provider) => provider.id === id);
}
