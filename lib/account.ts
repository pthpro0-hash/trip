/*
  지금 로그인한 사람을 화면에 어떻게 부를까.

  위 띠의 이름·사진 칩과 내 정보 화면이 같은 이름을 보여야 해서 한 곳에 둔다.
*/

export interface Account {
  name: string;
  avatar?: string;
}

/** 로그인 서비스가 주는 사용자 정보에서 화면에 쓸 것만. */
export function accountOf(user: { user_metadata?: Record<string, unknown>; email?: string }): Account {
  const meta = user.user_metadata ?? {};
  return {
    // 이름이 없을 수도 있다. 그때는 이메일 앞부분이라도 보여준다.
    name: (meta.full_name as string) || (meta.name as string) || user.email?.split("@")[0] || "내 계정",
    avatar: (meta.avatar_url as string | undefined) || undefined,
  };
}
