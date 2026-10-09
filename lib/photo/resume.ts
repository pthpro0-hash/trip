import { ADD_HREF } from "@/lib/nav";

/*
  로그인하러 갔다 돌아왔다는 표시.

  로그인하기 전에 맡겨 둔 사진과 여행(lib/photo/stash)은 이 표시가 붙은 주소로 돌아왔을 때만 되살린다. 같은 브라우저에서 다른 사람이
  로그인해 '사진으로 여행 추가'를 열었을 때, 앞사람이 로그인을 마치지 않고 남긴 사진이 그 사람의 '방금 고르신 여행'으로 뜨지 않게
  하려는 것이다. 표시는 우리가 사진을 맡기고 로그인으로 보낼 때(PhotoImport 의 [로그인하고 기록하기])만 달린다. 로그인을 마치면
  우리가 보낸 돌아올 주소(next)로 되돌려 주므로(app/auth/callback) 표시도 함께 돌아온다.
*/
export const RESUME_PARAM = "resume";

/** 사진을 맡겨 두고 로그인하러 갈 때의 주소. 로그인을 마치면 '사진으로 여행 추가'로 돌아오며 표시가 붙어 있다. */
export const RESUME_LOGIN_HREF = `/login?next=${encodeURIComponent(`${ADD_HREF}?${RESUME_PARAM}=1`)}`;

/** 주소의 쿼리(window.location.search)에 돌아왔다는 표시가 있는가. */
export function resumeRequested(search: string): boolean {
  return new URLSearchParams(search).get(RESUME_PARAM) === "1";
}
