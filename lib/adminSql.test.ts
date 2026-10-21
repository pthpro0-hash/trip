// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
  DB 는 시험 안에서 띄울 수 없다. supabase/admin.sql 의 규칙이 기획대로인지 글로 확인한다 — 한도를 화면에서만 막거나, 관리자
  확인을 빼먹거나, 관리자에게 쓰기까지 열어 주는 실수가 여기서 걸린다.
*/
const sql = readFileSync(join(process.cwd(), "supabase", "admin.sql"), "utf8");
const family = readFileSync(join(process.cwd(), "supabase", "family.sql"), "utf8");

/** 이름이 name 인 함수의 몸통. */
function body(name: string, source = sql): string {
  const at = source.indexOf(`function public.${name}(`);
  expect(at, `함수 ${name} 이 없다`).toBeGreaterThan(-1);
  return source.slice(at, source.indexOf("$$;", at));
}

describe("admin.sql · 등급과 한도", () => {
  it("한도는 1 무제한 · 2 2000 · 3 1000 · 그 밖(4) 500", () => {
    expect(body("grade_limit")).toContain("case g when 1 then null when 2 then 2000 when 3 then 1000 else 500 end");
  });

  it("등급 줄이 없으면 4등급(기본)", () => {
    expect(body("grade_of")).toMatch(/coalesce\(\(select grade from public\.member_grades where user_id = uid\), 4\)/);
  });

  it("등급 표는 자기 줄만 읽고, 쓰는 정책은 없다", () => {
    expect(sql).toContain("alter table public.member_grades enable row level security");
    expect(sql).toMatch(/member_grades_select_own[\s\S]*?auth\.uid\(\) = user_id/);
    expect(sql).not.toMatch(/on public\.member_grades for (insert|update|delete)/);
  });

  it("한도는 사진 줄을 넣기 직전에 DB 가 지킨다 — 주인마다 잠그고 세어 넘으면 photo_quota 로 거절", () => {
    const fn = body("trip_photos_quota");
    expect(fn).toContain("pg_advisory_xact_lock");
    expect(fn).toContain("used >= lim");
    expect(fn).toContain("raise exception 'photo_quota'");
    expect(sql).toMatch(/create trigger trip_photos_quota before insert on public\.trip_photos/);
  });

  it("한도와 사용량은 볼 권한이 있는 사람만 묻는다(나 · 가족 · 관리자)", () => {
    expect(body("photo_quota")).toContain("public.family_can(target, 'view')");
  });

  it("처음 한 번 모든 기존 계정을 1등급으로 — 날짜를 못 박아 나중에 다시 실행해도 새 가입자는 1등급이 되지 않는다", () => {
    expect(sql).toMatch(/insert into public\.member_grades \(user_id, grade\)\s+select id, 1 from auth\.users where created_at < timestamptz '[^']+'\s+on conflict \(user_id\) do nothing/);
  });
});

describe("admin.sql · 등업 신청", () => {
  it("지금보다 높은 등급만, 검토 전 신청은 하나뿐", () => {
    const fn = body("request_grade");
    expect(fn).toContain("to_grade >= current_grade");
    expect(fn).toContain("status = 'pending'");
    expect(sql).toContain("create unique index if not exists grade_requests_one_pending on public.grade_requests (user_id) where status = 'pending'");
  });

  it("신청 표는 자기 것만 읽고, 직접 쓰는 정책은 없다(함수로만 넣는다)", () => {
    expect(sql).toMatch(/grade_requests_select_own[\s\S]*?auth\.uid\(\) = user_id/);
    expect(sql).not.toMatch(/on public\.grade_requests for (insert|update|delete)/);
  });
});

describe("admin.sql · 관리자", () => {
  it("관리자 함수는 모두 안에서 관리자인지 확인하고, 하는 일을 기록한다", () => {
    for (const name of ["admin_members", "admin_set_grade", "admin_grade_requests", "admin_decide_request", "admin_log"]) {
      expect(body(name), name).toContain("if not public.is_app_admin() then");
    }
    expect(body("admin_set_grade")).toContain("insert into public.admin_audit");
    expect(body("admin_decide_request")).toContain("insert into public.admin_audit");
  });

  it("관리자 기록 표는 화면에서 읽고 쓸 수 없다(정책 없음)", () => {
    expect(sql).toContain("alter table public.admin_audit enable row level security");
    expect(sql).not.toMatch(/policy "[^"]*" on public\.admin_audit/);
  });

  it("관리자 보기는 '보기'만 — 고치기·올리기·지우기(edit/full)는 관리자에게도 열리지 않는다", () => {
    for (const source of [sql, family]) {
      const fn = body("family_can", source);
      expect(fn).toMatch(/need = 'view' and to_regclass\('public\.app_admins'\) is not null/);
      expect(fn).toContain("security definer");
    }
  });

  it("admin.sql 과 family.sql 의 family_can 은 똑같다 — 어느 파일을 나중에 실행해도 같은 함수가 남는다", () => {
    const norm = (text: string) => text.replace(/\r\n/g, "\n");
    expect(norm(body("family_can", sql))).toBe(norm(body("family_can", family)));
  });
});
