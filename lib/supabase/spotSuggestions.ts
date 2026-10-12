import type { SupabaseClient } from "@supabase/supabase-js";

/*
  빠진 곳 추천하기 — 이용자가 곳을 추천하고, 관리자가 반영 여부를 정한다(supabase/spotSuggest.sql).
  목록에 실제로 넣는 일은 개발로 한다. 여기는 추천과 결정의 기록만 읽고 쓴다.
*/

export type SuggestionStatus = "new" | "planned" | "duplicate" | "declined";

export const NAME_MAX = 60;
export const PLACE_MAX = 100;
export const REASON_MAX = 200;
export const NOTE_MAX = 300;
/** 검토 전 추천을 한 사람이 쌓아 둘 수 있는 수(표의 trigger 와 같다). */
export const PENDING_MAX = 5;

/** 이용자가 보는 이름. */
export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  new: "검토 중",
  planned: "반영 예정",
  duplicate: "이미 있어요",
  declined: "이번엔 어려워요",
};

export interface Suggestion {
  id: string;
  userId: string;
  name: string;
  place: string | null;
  reason: string | null;
  status: SuggestionStatus;
  adminNote: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  user_id: string;
  name: string;
  place: string | null;
  reason: string | null;
  status: SuggestionStatus;
  admin_note: string | null;
  created_at: string;
}

const COLUMNS = "id,user_id,name,place,reason,status,admin_note,created_at";

const toSuggestion = (row: Row): Suggestion => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  place: row.place,
  reason: row.reason,
  status: row.status,
  adminNote: row.admin_note,
  createdAt: row.created_at,
});

const blank = (value: string) => {
  const text = value.trim();
  return text === "" ? null : text;
};

export interface SuggestionInput {
  name: string;
  place: string;
  reason: string;
}

/** ok · invalid(이름이 없거나 길다) · limit(검토 전 추천이 이미 다섯) · failed. */
export async function submitSuggestion(
  supabase: SupabaseClient,
  userId: string,
  input: SuggestionInput,
): Promise<"ok" | "invalid" | "limit" | "failed"> {
  const name = input.name.trim();
  const place = blank(input.place);
  const reason = blank(input.reason);
  if (!name || name.length > NAME_MAX || (place?.length ?? 0) > PLACE_MAX || (reason?.length ?? 0) > REASON_MAX) return "invalid";
  try {
    const { error } = await supabase.from("spot_suggestions").insert({ user_id: userId, name, place, reason });
    if (!error) return "ok";
    return `${error.message ?? ""}`.includes("too_many_pending") ? "limit" : "failed";
  } catch {
    return "failed";
  }
}

/** 내가 보낸 추천(최신 먼저). 못 읽으면 null. */
export async function fetchMySuggestions(supabase: SupabaseClient, userId: string): Promise<Suggestion[] | null> {
  try {
    const { data, error } = await supabase
      .from("spot_suggestions")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return null;
    return (data as Row[]).map(toSuggestion);
  } catch {
    return null;
  }
}

/** 검토 전인 내 추천을 거둔다. */
export async function removeSuggestion(supabase: SupabaseClient, id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("spot_suggestions").delete().eq("id", id).select("id");
    return !error && Boolean(data?.length);
  } catch {
    return false;
  }
}

/** 관리자인가(app_admins 에 내 줄이 있다). */
export async function isAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("app_admins").select("user_id").eq("user_id", userId).limit(1);
    return !error && Boolean(data?.length);
  } catch {
    return false;
  }
}

/** 관리자: 모든 추천(검토 전 먼저, 그다음 최신순). 못 읽으면 null. */
export async function fetchAllSuggestions(supabase: SupabaseClient): Promise<Suggestion[] | null> {
  try {
    const { data, error } = await supabase
      .from("spot_suggestions")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error || !data) return null;
    const list = (data as Row[]).map(toSuggestion);
    // 검토 전인 것을 앞으로(같은 상태끼리는 최신순을 그대로).
    return [...list.filter((item) => item.status === "new"), ...list.filter((item) => item.status !== "new")];
  } catch {
    return null;
  }
}

/** 관리자: 상태와 메모를 정한다. 권한이 없어 한 줄도 안 바뀌면 false. */
export async function setSuggestionStatus(
  supabase: SupabaseClient,
  id: string,
  status: SuggestionStatus,
  note: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("spot_suggestions")
      .update({ status, admin_note: blank(note)?.slice(0, NOTE_MAX) ?? null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    return !error && Boolean(data?.length);
  } catch {
    return false;
  }
}
