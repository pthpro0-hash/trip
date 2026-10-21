import type { SupabaseClient } from "@supabase/supabase-js";
import { isGrade, type Grade, type Quota, type RequestStatus } from "@/lib/grade";

/*
  회원 등급 · 보관 한도 · 등업 신청 · 관리자 — supabase/admin.sql 의 함수를 부른다.

  admin.sql 을 아직 실행하지 않은 곳에서도 화면이 깨지지 않게, 못 읽으면 null·"failed" 로 돌려주고 부르는 쪽은 조용히 넘어간다
  (한도 막대를 안 그리고, 올리기는 막지 않는다 — 막는 규칙도 그때는 아직 없다).
*/

interface QuotaRow {
  grade: number;
  limit: number | null;
  used: number;
}

function toQuota(value: unknown): Quota | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<QuotaRow>;
  if (!isGrade(row.grade) || typeof row.used !== "number") return null;
  const limit = typeof row.limit === "number" ? row.limit : null;
  return { grade: row.grade, limit, used: row.used };
}

/** 그 사람(비우면 나)의 등급·한도·사용량. 못 읽으면 null. */
export async function fetchQuota(supabase: SupabaseClient, owner?: string): Promise<Quota | null> {
  try {
    const { data, error } = await supabase.rpc("photo_quota", owner ? { owner } : {});
    if (error) return null;
    return toQuota(data);
  } catch {
    return null;
  }
}

/** DB 가 한도로 사진 줄을 거절했나(trip_photos_quota). */
export const isQuotaError = (error: { message?: string } | null | undefined): boolean =>
  !!error && typeof error.message === "string" && error.message.includes("photo_quota");

/* ── 등업 신청 ─────────────────────────────────────────── */

export interface GradeRequest {
  id: string;
  fromGrade: Grade;
  toGrade: Grade;
  message: string | null;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface RequestRow {
  id: string;
  from_grade: number;
  to_grade: number;
  message: string | null;
  status: RequestStatus;
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
}

const toRequest = (row: RequestRow): GradeRequest | null =>
  isGrade(row.from_grade) && isGrade(row.to_grade)
    ? {
        id: row.id,
        fromGrade: row.from_grade,
        toGrade: row.to_grade,
        message: row.message,
        status: row.status,
        adminNote: row.admin_note,
        createdAt: row.created_at,
        decidedAt: row.decided_at,
      }
    : null;

/** 내 가장 최근 신청(검토 전이든 결정됐든). 없으면 null, 못 읽으면 "failed". */
export async function fetchMyRequest(supabase: SupabaseClient, userId: string): Promise<GradeRequest | null | "failed"> {
  try {
    const { data, error } = await supabase
      .from("grade_requests")
      .select("id,from_grade,to_grade,message,status,admin_note,created_at,decided_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return "failed";
    const row = (data as RequestRow[] | null)?.[0];
    return row ? toRequest(row) : null;
  } catch {
    return "failed";
  }
}

export type RequestResult = "ok" | "login" | "invalid" | "pending" | "failed";

export async function requestGrade(supabase: SupabaseClient, toGrade: Grade, message: string): Promise<RequestResult> {
  try {
    const { data, error } = await supabase.rpc("request_grade", { to_grade: toGrade, message: message.trim() || null });
    if (error) return "failed";
    return data === "ok" || data === "login" || data === "invalid" || data === "pending" ? data : "failed";
  } catch {
    return "failed";
  }
}

export async function cancelGradeRequest(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("cancel_grade_request");
    return !error && data === true;
  } catch {
    return false;
  }
}

/* ── 관리자 ───────────────────────────────────────────── */

export interface AdminMember {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  grade: Grade;
  photoCount: number;
  tripCount: number;
  /** 검토 전 등업 신청이 바라는 등급. 없으면 null. */
  pendingTo: Grade | null;
}

interface MemberRow {
  user_id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  grade: number;
  photo_count: number | string;
  trip_count: number | string;
  pending_to: number | null;
}

export type MemberSort = "recent" | "photos";

/** 한 번에 읽는 줄 수. 하나 더 달라고 해서 "더 보기"가 있는지 안다. */
export const MEMBERS_PAGE = 50;

export async function fetchMembers(
  supabase: SupabaseClient,
  query: string,
  sort: MemberSort,
  offset = 0,
): Promise<{ members: AdminMember[]; more: boolean } | "failed"> {
  try {
    const { data, error } = await supabase.rpc("admin_members", {
      q: query.trim() || null,
      sort,
      lim: MEMBERS_PAGE + 1,
      off: offset,
    });
    if (error) return "failed";
    const rows = (data as MemberRow[] | null) ?? [];
    const members = rows.slice(0, MEMBERS_PAGE).map(
      (row): AdminMember => ({
        id: row.user_id,
        email: row.email,
        createdAt: row.created_at,
        lastSignInAt: row.last_sign_in_at,
        grade: isGrade(row.grade) ? row.grade : 4,
        photoCount: Number(row.photo_count) || 0,
        tripCount: Number(row.trip_count) || 0,
        pendingTo: isGrade(row.pending_to) ? row.pending_to : null,
      }),
    );
    return { members, more: rows.length > MEMBERS_PAGE };
  } catch {
    return "failed";
  }
}

export async function setMemberGrade(supabase: SupabaseClient, userId: string, grade: Grade): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("admin_set_grade", { target: userId, g: grade });
    return !error;
  } catch {
    return false;
  }
}

export interface AdminRequest extends GradeRequest {
  userId: string;
  email: string | null;
  gradeNow: Grade;
  photoCount: number;
}

interface AdminRequestRow extends RequestRow {
  user_id: string;
  email: string | null;
  grade_now: number;
  photo_count: number | string;
}

export async function fetchGradeRequests(supabase: SupabaseClient): Promise<AdminRequest[] | "failed"> {
  try {
    const { data, error } = await supabase.rpc("admin_grade_requests");
    if (error) return "failed";
    return ((data as AdminRequestRow[] | null) ?? []).flatMap((row) => {
      const base = toRequest(row);
      if (!base) return [];
      return [
        {
          ...base,
          userId: row.user_id,
          email: row.email,
          gradeNow: isGrade(row.grade_now) ? row.grade_now : 4,
          photoCount: Number(row.photo_count) || 0,
        },
      ];
    });
  } catch {
    return "failed";
  }
}

export async function decideGradeRequest(
  supabase: SupabaseClient,
  requestId: string,
  approve: boolean,
  note: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("admin_decide_request", {
      request: requestId,
      approve,
      note: note.trim() || null,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** 관리자가 남의 계정을 "보기"로 연 것을 남긴다. 남기지 못하면 열지 않는다(부르는 쪽이 false 를 본다). */
export async function logAccountView(supabase: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("admin_log", { action: "view_account", target: userId, detail: {} });
    return !error;
  } catch {
    return false;
  }
}
