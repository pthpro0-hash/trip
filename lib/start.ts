/*
  첫 화면의 큰 갈래 — 내 여행과 여행 100선.

  어느 쪽에서 시작할지는 사람이 고르고, 한 번 고르면 다음에도 그쪽으로
  연다. 내 사진이 쌓인 사람에게 첫 화면이 매번 남의 여행지 목록이면
  문 앞에서 한 번씩 돌아가야 한다.

  기억은 쿠키에 둔다. 서버가 첫 화면을 그리기 전에 읽을 수 있는 것이
  쿠키뿐이다 — 브라우저 저장소에 두면 여행 100선을 한 번 보여 줬다가
  내 여행으로 바꾸느라 화면이 번쩍인다.

  주소에 갈래를 적으면(?v=sketch) 그게 기억보다 앞선다. 링크를 건네받은
  사람은 건넨 사람이 본 화면을 봐야 한다.

  검색엔진은 쿠키가 없으므로 언제나 여행 100선을 본다. 이 사이트가
  검색에 걸리는 이유가 거기 있다.

  기억은 로그인했을 수 있는 사람에게만 따른다(lib/sessionCookie). 로그인하지 않은 사람에게 내 여행은 보여 줄 것이
  없는 빈 지도라, 로그아웃했거나 세션이 끝난 사람은 기억이 내 여행이어도 여행 100선(환영 팝업이 뜨는 곳)으로 열린다.
*/

export type Start = "sketch" | "spots";

export const START_COOKIE = "start";

/** 주소가 먼저, 그다음 기억, 둘 다 없으면 여행 100선. */
export function startOf(fromUrl: string | undefined, remembered: string | undefined): Start {
  if (fromUrl === "sketch" || fromUrl === "spots") return fromUrl;
  return remembered === "sketch" ? "sketch" : "spots";
}

export function startHref(start: Start): string {
  return start === "sketch" ? "/?v=sketch" : "/?v=spots";
}

/** 고른 갈래를 기억한다. 한 해 동안. */
export function rememberStart(start: Start): void {
  try {
    document.cookie = `${START_COOKIE}=${start}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // 쿠키가 막혀 있으면 기억만 못 할 뿐, 가는 데는 지장이 없다.
  }
}

/** 지난번에 고른 갈래. 고른 적이 없으면(엉뚱한 값도) null. */
export function readStart(): Start | null {
  try {
    const found = document.cookie.match(new RegExp(`(?:^|;\\s*)${START_COOKIE}=([^;]*)`));
    return found?.[1] === "sketch" || found?.[1] === "spots" ? found[1] : null;
  } catch {
    return null;
  }
}

/*
  아직 고른 적이 없을 때만 기억한다.

  여행을 기록한 사람은 다음부터 "내 여행"으로 열리는 게 맞다 — 그 사람에게
  첫 화면의 여행 100선은 문 앞에서 한 번 돌아가는 일이다. 그런데 갈래를 눌러서
  100선을 고른 사람의 선택을 뒤집으면 안 된다. 그래서 고른 적이 없을 때만 쓴다.
*/
export function rememberStartIfUnset(start: Start): void {
  if (readStart() === null) rememberStart(start);
}
