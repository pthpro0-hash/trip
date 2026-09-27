/*
  한 번 본 것은 다시 내밀지 않는다.

  안내 팝업이 올 때마다 뜨면, 두 번째부터는 안내가 아니라 방해다.
  사람들은 그때부터 읽지 않고 닫는 법부터 배운다.

  브라우저에 남긴다 — 로그인하지 않은 사람에게도 처음은 한 번뿐이어야
  하고, 이건 계정에 남겨 둘 만큼 중요한 사실이 아니다.
*/

/** 저장소가 막혀 있어도(사생활 보호 창 등) 앱이 멈추지 않게 한다. */
function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSeen(key: string): boolean {
  return store()?.getItem(`seen:${key}`) === "1";
}

export function markSeen(key: string): void {
  store()?.setItem(`seen:${key}`, "1");
}
