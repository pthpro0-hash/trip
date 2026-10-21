/*
  회원 등급 — 사진 보관 한도(supabase/admin.sql).

    1등급 무제한 · 2등급 2,000장 · 3등급 1,000장 · 4등급 500장(기본)

  세는 것은 내 여행에 보관한 사진 장수다. 엽서·가족 사진첩으로 보낸 사진과 공유용 한 장은 세지 않는다. 여행별 한도는 없다.
  한도를 지키는 것은 DB 의 규칙이고, 화면은 남은 자리를 미리 알려 다시 고르게 할 뿐이다.

  이용자에게는 등급 번호 대신 한도("보관 한도 500장")를 보인다. 번호는 관리자 화면에서만 쓴다.
*/

export const GRADES = [1, 2, 3, 4] as const;
export type Grade = (typeof GRADES)[number];

/** 새로 가입한 사람의 등급. */
export const DEFAULT_GRADE: Grade = 4;

const LIMITS: Record<Grade, number | null> = { 1: null, 2: 2000, 3: 1000, 4: 500 };

export const isGrade = (value: unknown): value is Grade =>
  typeof value === "number" && (GRADES as readonly number[]).includes(value);

/** 그 등급의 보관 한도. null 은 무제한. */
export const limitOf = (grade: Grade): number | null => LIMITS[grade];

/** "500장" · "2,000장" · "무제한". */
export function limitLabel(limit: number | null): string {
  return limit === null ? "무제한" : `${limit.toLocaleString("ko-KR")}장`;
}

/** 관리자 화면의 이름. "4등급 · 500장". */
export const gradeLabel = (grade: Grade): string => `${grade}등급 · ${limitLabel(limitOf(grade))}`;

export interface Quota {
  grade: Grade;
  /** null 은 무제한. */
  limit: number | null;
  used: number;
}

/** 남은 자리. 무제한이면 null. 이미 넘었으면(등급이 내려간 경우) 0. */
export function roomLeft(quota: Quota): number | null {
  return quota.limit === null ? null : Math.max(0, quota.limit - quota.used);
}

/** 쓴 비율(0~1). 무제한이면 0. */
export function usedRatio(quota: Quota): number {
  if (quota.limit === null || quota.limit === 0) return 0;
  return Math.min(1, quota.used / quota.limit);
}

/** 거의 다 찼다(80% 이상). 한 번 알린다. */
export const nearlyFull = (quota: Quota): boolean => quota.limit !== null && usedRatio(quota) >= 0.8;

/** 이만큼 더 올릴 수 있나. 모르면(쿼터를 못 읽었으면) 막지 않는다 — 마지막으로 막는 것은 DB 다. */
export function fits(quota: Quota | null, adding: number): boolean {
  if (!quota) return true;
  const left = roomLeft(quota);
  return left === null || adding <= left;
}

/** 지금보다 높은 등급(숫자가 작은 쪽) — 등업 신청에서 고를 수 있는 것. 1등급이면 빈 목록. */
export const upgradesFrom = (grade: Grade): Grade[] => GRADES.filter((g) => g < grade);

export type RequestStatus = "pending" | "approved" | "declined";

export const REQUEST_MESSAGE_MAX = 300;
