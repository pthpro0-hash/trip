/*
  가족 공유 — 내 여행 전체를 가족과 함께 본다.

  링크 공유(lib/share)가 "한 장을 베껴서 보여 주는 것"이라면, 이것은 "내 기록 자체에
  가족을 들이는 것"이다. 그래서 권한이 필요하고, 그 규칙은 화면이 아니라 DB(supabase/
  family.sql)가 지킨다. 여기 있는 것은 화면이 같은 규칙을 알고 단추를 숨기는 데 쓰는
  셈이다 — 숨기는 것은 친절이고, 막는 것은 DB 다.

  권한은 낮은 것부터 셋이다.
    view  보기만
    edit  수정만 — 고칠 수 있지만 더하거나 지우지는 못한다
    full  추가도 가능 — 여행과 사진을 더하고 지울 수 있다
*/

export const FAMILY_ROLES = ["view", "edit", "full"] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

/** 한 사람이 들일 수 있는 가족의 수. DB 도 같은 수로 막는다. */
export const FAMILY_LIMIT = 8;

/** 초대 링크가 살아 있는 날수. */
export const INVITE_DAYS = 7;

export type FamilyAction = "read" | "edit" | "add" | "remove";

/** 각 권한이 할 수 있는 일. 높은 권한은 낮은 권한의 일을 모두 한다. */
const CAN: Record<FamilyRole, FamilyAction[]> = {
  view: ["read"],
  edit: ["read", "edit"],
  full: ["read", "edit", "add", "remove"],
};

/**
 * 이 권한으로 그 일을 할 수 있는가. 권한이 null 이면 주인 본인이라 모두 할 수 있다.
 * 모르는 권한은 아무것도 허락하지 않는다.
 */
export function canDo(role: FamilyRole | null, action: FamilyAction): boolean {
  if (role === null) return true;
  return CAN[role]?.includes(action) ?? false;
}

export function isFamilyRole(value: unknown): value is FamilyRole {
  return typeof value === "string" && (FAMILY_ROLES as readonly string[]).includes(value);
}

const LABEL: Record<FamilyRole, string> = { view: "보기만", edit: "수정만", full: "추가도 가능" };
const HINT: Record<FamilyRole, string> = {
  view: "내 여행을 보기만 해요.",
  edit: "여행 제목·메모·곳 이름을 고칠 수 있어요. 더하거나 삭제는 못 해요.",
  full: "여행과 사진을 올리고, 삭제도 할 수 있어요.",
};

export const roleLabel = (role: FamilyRole): string => LABEL[role];
export const roleHint = (role: FamilyRole): string => HINT[role];

/* ── 초대 링크 ─────────────────────────────────────────────── */

const TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

export const isInviteToken = (value: string): boolean => TOKEN.test(value);

/** 짐작해서 맞힐 수 없는 무작위 글자(256비트). 주소에 그대로 넣어도 안전한 글자만 쓴다. */
export function newInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function inviteExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_DAYS * 24 * 60 * 60 * 1000);
}

/** 만료 시각이 되었거나 읽을 수 없는 값이면 쓸 수 없다. */
export function inviteExpired(expiresAt: string, now: Date = new Date()): boolean {
  const at = Date.parse(expiresAt);
  return !Number.isFinite(at) || at <= now.getTime();
}
