/*
  내 여행으로 부르는 안내.

  처음 온 사람의 내 여행은 텅 비어 있다. 빈 지도를 보고는 무엇을 해
  주는지 알 수 없다. 그래서 자료가 없는 사람에게 한 장짜리 안내를
  내민다 — 사진만 올리면 무엇이 저절로 되는지.

  언제 내미나:
    - 첫 화면에서 한 번(이번 방문에).
    - 내 여행을 누르면 한 번 더 — 거기가 바로 그 일을 하는 곳이다.
    - "오늘 그만 보기"를 누르면 오늘은 더 내밀지 않는다.
    - 처음 온 사람에게 뜨는 사용법(FirstVisitHelp)을 닫기 전에는
      내밀지 않는다. 창 두 개가 겹치면 둘 다 안 읽는다.
*/

export type InviteSpot = "home" | "sketch";

const SNOOZE_KEY = "invite:snooze";
const shownKey = (spot: InviteSpot) => `invite:shown:${spot}`;

/** 이 기기 시각으로 오늘. "2026-09-28" */
export function todayKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface InviteState {
  /** 사용법 창을 이미 닫았는가. */
  helpSeen: boolean;
  /** "오늘 그만 보기"를 누른 날. */
  snoozedOn: string | null;
  /** 이번 방문에 이 자리에서 이미 내밀었는가. */
  shownHere: boolean;
  today: string;
}

export function shouldInvite(state: InviteState): boolean {
  return state.helpSeen && state.snoozedOn !== state.today && !state.shownHere;
}

/* 저장소가 막혀 있어도(사생활 보호 창 등) 앱은 멈추지 않는다 — 안내를 안 띄울 뿐이다. */

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string): void {
  try {
    storage().setItem(key, value);
  } catch {
    // 남기지 못하면 다음에 한 번 더 보일 뿐이다.
  }
}

const shown = (spot: InviteSpot) => read(() => window.sessionStorage, shownKey(spot)) === "1";

/*
  처음 연 화면은 어디든 "첫 화면"으로 친다 — 내 여행으로 바로 들어와도
  그렇다. 그 뒤 내 여행에 들어오면 한 번 더. 그래서 내 여행 자리는
  첫 화면 몫을 이미 쓴 뒤에야 따로 센다.
*/
export function inviteState(spot: InviteSpot, helpSeen: boolean, now: Date = new Date()): InviteState {
  const home = shown("home");
  return {
    helpSeen,
    snoozedOn: read(() => window.localStorage, SNOOZE_KEY),
    shownHere: spot === "home" ? home : home && shown("sketch"),
    today: todayKey(now),
  };
}

export function markInvited(spot: InviteSpot): void {
  write(() => window.sessionStorage, shownKey(shown("home") ? spot : "home"), "1");
}

export function snoozeInviteToday(now: Date = new Date()): void {
  write(() => window.localStorage, SNOOZE_KEY, todayKey(now));
}
