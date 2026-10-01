import type { SupabaseClient } from "@supabase/supabase-js";
import { inviteExpiresAt, isFamilyRole, isInviteToken, newInviteToken, type FamilyRole } from "@/lib/family";

/*
  가족 — 초대하고, 수락하고, 권한을 바꾸고, 끊는다.

  표와 규칙은 supabase/family.sql 에 있다. 여기서 알아 둘 것:

    - 가족 연결(family_links)은 직접 넣을 수 없다. 수락 함수(accept_family_invite)만
      만든다. 그래서 "남이 나를 가족으로 적는" 일이 없다.
    - 권한을 바꾸는 것은 주인만, 끊는 것은 둘 다 한다(DB 정책이 막는다).
    - 상대의 이메일은 family_circle() 로만 읽는다. 연결된 사이에서만 돌려준다.
*/

export interface Member {
  /** 상대의 id. 내가 들인 가족이면 가족, 나에게 열어 준 사람이면 주인. */
  id: string;
  email: string | null;
  role: FamilyRole;
  since: string;
}

export interface Circle {
  /** 내가 들인 가족. */
  owned: Member[];
  /** 나에게 내 여행을 열어 준 사람. */
  shared: Member[];
}

export interface PendingInvite {
  token: string;
  role: FamilyRole;
  expiresAt: string;
}

/** 초대를 만든다. 링크에 들어갈 글자를 돌려주고, 못 만들면 "failed". */
export async function createInvite(
  supabase: SupabaseClient,
  ownerId: string,
  role: FamilyRole,
  now: Date = new Date(),
): Promise<string | "failed"> {
  const token = newInviteToken();
  const { error } = await supabase.from("family_invites").insert({
    token,
    owner_id: ownerId,
    role,
    expires_at: inviteExpiresAt(now).toISOString(),
  });
  return error ? "failed" : token;
}

/** 아직 쓸 수 있는 내 초대들(만들어서 아직 수락 전이고, 만료 전). */
export async function fetchInvites(supabase: SupabaseClient, ownerId: string): Promise<PendingInvite[] | "failed"> {
  const { data, error } = await supabase
    .from("family_invites")
    .select("token,role,expires_at")
    .eq("owner_id", ownerId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) return "failed";
  return (data as { token: string; role: string; expires_at: string }[])
    .filter((row) => isFamilyRole(row.role))
    .map((row) => ({ token: row.token, role: row.role as FamilyRole, expiresAt: row.expires_at }));
}

/** 내가 들인 가족과, 나에게 열어 준 사람. */
export async function fetchCircle(supabase: SupabaseClient): Promise<Circle | "failed"> {
  const { data, error } = await supabase.rpc("family_circle");
  if (error || !Array.isArray(data)) return "failed";
  const circle: Circle = { owned: [], shared: [] };
  for (const row of data as {
    direction: string;
    other_id: string;
    other_email: string | null;
    role: string;
    created_at: string;
  }[]) {
    if (!isFamilyRole(row.role)) continue;
    const member: Member = { id: row.other_id, email: row.other_email, role: row.role, since: row.created_at };
    if (row.direction === "owned") circle.owned.push(member);
    else if (row.direction === "shared") circle.shared.push(member);
  }
  return circle;
}

/** 가족 한 사람의 권한을 바꾼다. 주인만 된다. */
export async function changeRole(
  supabase: SupabaseClient,
  ownerId: string,
  memberId: string,
  role: FamilyRole,
): Promise<boolean> {
  const { error } = await supabase
    .from("family_links")
    .update({ role })
    .eq("owner_id", ownerId)
    .eq("member_id", memberId);
  return !error;
}

/** 연결을 끊는다. 주인이 해제하거나 가족이 나가거나, 같은 일이다. */
export async function removeLink(supabase: SupabaseClient, ownerId: string, memberId: string): Promise<boolean> {
  const { error } = await supabase.from("family_links").delete().eq("owner_id", ownerId).eq("member_id", memberId);
  return !error;
}

/** 아직 수락되지 않은 초대를 거둔다. 링크는 그 순간부터 쓸 수 없다. */
export async function cancelInvite(supabase: SupabaseClient, token: string): Promise<boolean> {
  const { error } = await supabase.from("family_invites").delete().eq("token", token);
  return !error;
}

export type AcceptResult =
  | { ok: true; ownerId: string }
  | { ok: false; reason: "missing" | "used" | "expired" | "own" | "full" | "login" | "failed" };

/** DB 가 던진 말을 화면이 고를 수 있는 이유로 바꾼다. */
function reasonOf(message: string): Extract<AcceptResult, { ok: false }>["reason"] {
  if (message.includes("없는 초대")) return "missing";
  if (message.includes("이미 쓴")) return "used";
  if (message.includes("만료")) return "expired";
  if (message.includes("내 초대")) return "own";
  if (message.includes("8명")) return "full";
  if (message.includes("로그인")) return "login";
  return "failed";
}

/** 초대 링크의 글자로 가족이 된다. 로그인한 사람이 부른다. */
export async function acceptInvite(supabase: SupabaseClient, token: string): Promise<AcceptResult> {
  // 모양이 틀린 글자는 DB 에 묻지 않는다.
  if (!isInviteToken(token)) return { ok: false, reason: "missing" };
  const { data, error } = await supabase.rpc("accept_family_invite", { invite_token: token });
  if (error) return { ok: false, reason: reasonOf(error.message) };
  return typeof data === "string" ? { ok: true, ownerId: data } : { ok: false, reason: "failed" };
}

/** 가족에게 보낼 초대 주소. */
export const inviteUrl = (origin: string, token: string): string => `${origin}/join/${token}`;
