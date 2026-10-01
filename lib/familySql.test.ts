// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
  DB 는 시험 안에서 띄울 수 없다. 대신 supabase/family.sql 에 적힌 규칙이 기획대로인지
  글로 확인한다 — 누가 정책 한 줄을 지우거나 권한을 헐겁게 바꾸면 여기서 걸린다.
  실제 동작은 SQL 을 실행한 뒤 두 계정으로 확인한다.
*/
const sql = readFileSync(join(process.cwd(), "supabase", "family.sql"), "utf8");

/** 이름이 `name` 인 정책 한 덩어리(다음 세미콜론까지). */
function policy(name: string): string {
  const start = sql.indexOf(`policy "${name}"`);
  expect(start, `정책 ${name} 이 없다`).toBeGreaterThan(-1);
  const end = sql.indexOf(";", start);
  return sql.slice(start, end);
}

describe("family.sql · 표", () => {
  it("가족 연결과 초대 표가 있고 둘 다 행 수준 보안이 켜져 있다", () => {
    for (const table of ["family_links", "family_invites"]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("권한은 view/edit/full 셋뿐이다", () => {
    expect(sql).toMatch(/role\s+text\s+not null check \(role in \('view', 'edit', 'full'\)\)/);
  });

  it("자기 자신과는 연결할 수 없다", () => {
    expect(sql).toMatch(/check \(owner_id <> member_id\)/);
  });

  it("가족은 한 사람에게 8명까지다", () => {
    expect(sql).toMatch(/>= 8/);
  });

  it("계정을 지우면 연결도 함께 지워진다", () => {
    expect(sql.match(/references auth\.users \(id\) on delete cascade/g)!.length).toBeGreaterThanOrEqual(4);
  });
});

describe("family.sql · 함수", () => {
  it("권한 확인 함수는 security definer 라 정책끼리 서로를 부르는 재귀가 없다", () => {
    const at = sql.indexOf("function public.family_can(");
    expect(at).toBeGreaterThan(-1);
    expect(sql.slice(at, at + 900)).toContain("security definer");
  });

  it("초대 수락은 한 번뿐이고 만료를 본다", () => {
    const at = sql.indexOf("function public.accept_family_invite(");
    expect(at).toBeGreaterThan(-1);
    const body = sql.slice(at, sql.indexOf("$$;", at));
    expect(body).toContain("expires_at");
    expect(body).toContain("used_at");
    expect(body).toContain("auth.uid()");
  });

  it("가족 표에 직접 넣는 길은 없다 — 수락 함수로만 연결된다", () => {
    expect(sql).not.toMatch(/policy "family_links_insert/);
  });
});

describe("family.sql · 여행 자료의 권한", () => {
  const TABLES = ["trips", "visits", "trip_photos"];

  it.each(TABLES)("%s: 읽기는 보기 이상", (table) => {
    expect(policy(`${table}_select_family`)).toContain("family_can(user_id, 'view')");
  });

  it.each(TABLES)("%s: 고치기는 수정 이상", (table) => {
    expect(policy(`${table}_update_family`)).toContain("family_can(user_id, 'edit')");
  });

  it.each(TABLES)("%s: 더하기·지우기는 추가도 가능에서만", (table) => {
    expect(policy(`${table}_insert_family`)).toContain("family_can(user_id, 'full')");
    expect(policy(`${table}_delete_family`)).toContain("family_can(user_id, 'full')");
  });

  it("한 줄·곳 이름은 수정 권한이면 쓰고 지울 수 있다 — 처음 적는 것도 '수정'이다", () => {
    for (const table of ["sketch_years", "place_names"]) {
      expect(policy(`${table}_select_family`)).toContain("'view'");
      for (const verb of ["insert", "update", "delete"]) {
        expect(policy(`${table}_${verb}_family`)).toContain("family_can(user_id, 'edit')");
      }
    }
  });

  it("남의 자료를 넣을 때도 주인 칸(user_id)은 그 주인이어야 한다", () => {
    // with check 가 family_can(user_id, …) 이므로 주인 칸이 곧 권한을 준 사람이다.
    expect(policy("trips_insert_family")).toContain("with check");
  });
});

describe("family.sql · 링크로 보여 주는 여행", () => {
  it("추가도 가능 가족은 여행의 링크 줄을 읽을 수 있다 — 그래야 링크가 걸린 여행의 삭제가 멈춘다", () => {
    expect(sql).toContain('policy "trip_shares_select_family" on public.trip_shares');
    expect(sql).toMatch(/trip_shares_select_family[\s\S]*?family_can\(user_id, 'full'\)/);
  });

  it("끊기(지우기)는 가족에게 열지 않는다 — 주인만", () => {
    expect(sql).not.toMatch(/trip_shares_(insert|update|delete)_family/);
  });
});

describe("family.sql · 주인 칸", () => {
  it("다섯 표 모두 고치기로 user_id 를 바꾸지 못한다 — 수정 권한으로 자료를 자기 계정에 옮기는 길을 막는다", () => {
    expect(sql).toContain("new.user_id is distinct from old.user_id");
    for (const table of ["trips", "visits", "trip_photos", "sketch_years", "place_names"]) {
      expect(sql).toContain(`before update on public.${table}`);
    }
  });
});

describe("family.sql · 사진 보관함", () => {
  it("읽기는 보기, 올리기·고치기·지우기는 추가도 가능", () => {
    expect(policy("photo_files_read_family")).toContain("'view'");
    for (const verb of ["insert", "update", "delete"]) {
      expect(policy(`photo_files_${verb}_family`)).toContain("'full'");
    }
  });

  it("폴더 이름이 uuid 가 아니어도 오류 없이 거절한다 — 함수 안에서 안전하게 바꾼다", () => {
    expect(sql).toContain("function public.family_can_folder(");
  });
});

describe("family.sql · 가족 목록 화면용", () => {
  it("서로의 이메일은 연결된 사이에서만 본다", () => {
    const at = sql.indexOf("function public.family_circle(");
    expect(at).toBeGreaterThan(-1);
    const body = sql.slice(at, sql.indexOf("$$;", at));
    expect(body).toContain("auth.uid()");
    expect(body).toContain("security definer");
  });
});
