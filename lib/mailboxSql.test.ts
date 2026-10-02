// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
  DB 는 시험 안에서 띄울 수 없다. supabase/mailbox.sql 에 적힌 규칙이 기획대로인지 글로 확인한다
  (family.sql 과 같은 방식). 실제 동작은 SQL 을 실행한 뒤 계정 두 개와 로그인 안 한 브라우저로 본다.
*/
const sql = readFileSync(join(process.cwd(), "supabase", "mailbox.sql"), "utf8");

/** 이름이 `name` 인 정책 한 덩어리(다음 세미콜론까지). */
function policy(name: string): string {
  const start = sql.indexOf(`policy "${name}"`);
  expect(start, `정책 ${name} 이 없다`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf(";", start));
}

/** 함수 하나의 몸통(다음 `$$;` 까지). */
function fn(name: string): string {
  const at = sql.indexOf(`function public.${name}(`);
  expect(at, `함수 ${name} 이 없다`).toBeGreaterThan(-1);
  return sql.slice(at, sql.indexOf("$$;", at));
}

describe("mailbox.sql · 표", () => {
  const TABLES = [
    "mailboxes",
    "mailbox_senders",
    "mailbox_invites",
    "postcards",
    "postcard_photos",
    "postcard_deliveries",
    "postcard_replies",
    "postcard_ids",
  ];

  it.each(TABLES)("%s 표가 있고 행 수준 보안이 켜져 있다", (table) => {
    expect(sql).toContain(`create table if not exists public.${table}`);
    expect(sql).toContain(`alter table public.${table} enable row level security`);
  });

  it("우편함 링크 글자와 엽서 주소는 길이·글자를 DB 가 막는다", () => {
    expect(sql).toMatch(/token\s+text\s+not null unique check \(token ~ '\^\[A-Za-z0-9_-\]\{32,64\}\$'\)/);
    expect(sql).toMatch(/id\s+text\s+primary key check \(id ~ '\^\[A-Za-z0-9_-\]\{16,64\}\$'\)/);
  });

  it("말투는 casual/polite 둘, 보내는 사람 역할은 owner/sender 둘", () => {
    expect(sql).toMatch(/tone\s+text\s+not null default 'casual' check \(tone in \('casual', 'polite'\)\)/);
    expect(sql).toMatch(/role\s+text\s+not null check \(role in \('owner', 'sender'\)\)/);
  });

  it("엽서는 여행이 지워지면 함께 지워지고, 복사본 기록도 엽서를 따라 지워진다", () => {
    expect(sql).toMatch(/trip_id\s+uuid\s+not null references public\.trips \(id\) on delete cascade/);
    expect(sql).toMatch(/postcard_id\s+text\s+not null references public\.postcards \(id\) on delete cascade/);
  });

  it("계정을 지우면 보낸 엽서·우편함이 함께 지워진다", () => {
    expect(sql).toMatch(/sender_id\s+uuid\s+not null references auth\.users \(id\) on delete cascade/);
    expect(sql).toMatch(/owner_id\s+uuid\s+not null references auth\.users \(id\) on delete cascade/);
  });

  it("글자 수 한도(본문 300, 이름 40, 호칭 20)를 DB 가 막는다", () => {
    expect(sql).toMatch(/length\(name\) between 1 and 40/);
    expect(sql).toMatch(/length\(greeting_name\) between 1 and 20/);
    expect(sql).toMatch(/length\(greeting\) <= 300/);
  });
});

describe("mailbox.sql · 한도", () => {
  it("한 사람이 만들 수 있는 우편함은 3개", () => {
    expect(fn("mailboxes_limit")).toMatch(/>= 3/);
  });

  it("한 우편함의 보내는 사람은 8명", () => {
    expect(fn("mailbox_senders_limit")).toMatch(/>= 8/);
  });

  it("닫은 우편함을 다시 열 때도 열린 것이 3개를 넘지 않는다 — 닫았다 열기로 한도를 피하지 못한다", () => {
    expect(fn("mailboxes_keep")).toMatch(/>= 3/);
    expect(fn("mailboxes_keep")).toContain("old.closed_at is not null and new.closed_at is null");
  });

  it("우편함을 만들면 만든 사람이 주인으로 보내는 사람에 자동으로 적힌다", () => {
    expect(fn("mailboxes_add_owner")).toContain("'owner'");
  });
});

describe("mailbox.sql · 보내는 사람의 권한", () => {
  it("우편함은 주인과 보내는 사람만 읽고, 고치고 닫는 것은 주인만", () => {
    expect(policy("mailboxes_select")).toContain("is_mailbox_sender(id)");
    expect(policy("mailboxes_update")).toMatch(/auth\.uid\(\) = owner_id/);
    expect(policy("mailboxes_delete")).toMatch(/auth\.uid\(\) = owner_id/);
  });

  it("권한 확인 함수는 security definer — 정책끼리 서로를 부르는 재귀가 없다", () => {
    expect(fn("is_mailbox_sender")).toContain("security definer");
    expect(fn("can_send_to")).toContain("security definer");
  });

  it("닫은 우편함에는 보낼 수 없다", () => {
    expect(fn("can_send_to")).toContain("closed_at is null");
  });

  it("엽서는 보낸 사람 것만 읽고 지우며, 고치는 길이 없다 — 보낸 순간 그대로", () => {
    expect(policy("postcards_select_own")).toMatch(/auth\.uid\(\) = sender_id/);
    expect(policy("postcards_delete_own")).toMatch(/auth\.uid\(\) = sender_id/);
    expect(sql).not.toMatch(/policy "postcards_update/);
  });

  it("엽서는 내 여행으로만 만든다(남의 여행으로 못 만든다)", () => {
    const rule = policy("postcards_insert_own");
    expect(rule).toContain("auth.uid() = sender_id");
    expect(rule).toMatch(/t\.user_id = auth\.uid\(\)/);
  });

  it("우편함에 넣는 것은 보낼 수 있는 우편함에, 내 엽서만", () => {
    const rule = policy("postcard_deliveries_insert");
    expect(rule).toContain("can_send_to(mailbox_id)");
    expect(rule).toMatch(/p\.sender_id = auth\.uid\(\)/);
  });

  it("엽서의 주소·보낸 사람·여행은 바꿀 수 없다", () => {
    expect(fn("postcards_keep")).toContain("sender_id");
    expect(sql).toMatch(/before update on public\.postcards/);
  });

  it("쓴 엽서 주소는 장부에 적어 다시 쓰지 못한다", () => {
    expect(fn("postcards_claim_id")).toContain("postcard_ids");
    expect(sql).toMatch(/before insert on public\.postcards/);
  });

  it("보내는 사람 초대는 한 번만, 만료를 보고, 우편함 주인만 만든다", () => {
    const body = fn("accept_mailbox_invite");
    expect(body).toContain("used_at");
    expect(body).toContain("expires_at");
    expect(body).toContain("auth.uid()");
    expect(policy("mailbox_invites_insert")).toMatch(/mailboxes m[\s\S]*m\.owner_id = auth\.uid\(\)/);
  });

  it("보내는 사람 표에 직접 넣는 길은 없다 — 수락 함수로만", () => {
    expect(sql).not.toMatch(/policy "mailbox_senders_insert/);
  });
});

describe("mailbox.sql · 받는 쪽(로그인 없음)", () => {
  const RPCS = ["mailbox_view", "mailbox_postcard", "mailbox_open", "mailbox_reply"];

  it.each(RPCS)("%s 는 security definer 이고 로그인 없는 사람에게 열려 있다", (name) => {
    expect(fn(name)).toContain("security definer");
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to anon, authenticated`));
    expect(sql).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public`));
  });

  it("받는 쪽 표(우편함·엽서·답장)에는 로그인 없는 사람의 정책이 하나도 없다", () => {
    expect(sql).not.toMatch(/to anon\b[^;]*(create policy|for select)/);
    expect(sql).not.toMatch(/create policy[^;]*\bto anon\b/);
  });

  it("우편함 링크가 맞는 것만 돌려준다 — 닫힌 우편함은 아무것도 주지 않는다", () => {
    for (const name of RPCS) expect(fn(name)).toContain("closed_at is null");
  });

  it("엽서 한 장은 그 우편함에 넣은 것만 돌려준다", () => {
    expect(fn("mailbox_postcard")).toContain("postcard_deliveries");
  });

  it("엽서를 읽는 함수는 읽기만 한다 — 열어 본 시각은 따로(mailbox_open) 적는다", () => {
    // 카카오톡 미리보기 같은 기계가 링크를 읽어 가도 "읽으셨어요"가 찍히지 않게.
    expect(fn("mailbox_postcard")).not.toContain("opened_at");
    expect(fn("mailbox_postcard")).not.toMatch(/update/);
    expect(fn("mailbox_open")).toContain("opened_at");
    expect(fn("mailbox_open")).toContain("coalesce");
  });

  it("답장은 짧게, 너무 자주는 안 된다", () => {
    const body = fn("mailbox_reply");
    expect(body).toMatch(/length\(.*reaction.*\)/);
    expect(body).toContain("interval");
  });

  it("받는 쪽에 보내는 사람의 이메일·id 는 내보내지 않는다", () => {
    for (const name of RPCS) {
      const body = fn(name);
      expect(body).not.toMatch(/auth\.users/);
      expect(body).not.toMatch(/'sender_id'|'ownerId'|'userId'|'email'/);
    }
  });
});

describe("mailbox.sql · 답장·열어 봄", () => {
  it("보낸 사람은 자기 엽서의 답장을 읽고 '봤다'고 표시한다", () => {
    expect(policy("postcard_replies_select")).toMatch(/p\.sender_id = auth\.uid\(\)/);
    expect(policy("postcard_replies_update")).toMatch(/p\.sender_id = auth\.uid\(\)/);
  });

  it("답장은 함수로만 쌓인다 — 직접 넣는 길이 없다", () => {
    expect(sql).not.toMatch(/policy "postcard_replies_insert/);
  });

  it("답장에서 고칠 수 있는 것은 seen_at 하나뿐이다", () => {
    expect(fn("postcard_replies_only_seen")).toContain("seen_at");
    expect(sql).toMatch(/before update on public\.postcard_replies/);
  });
});

describe("mailbox.sql · 사진 보관함(postcards 버킷)", () => {
  it("엽서 사진은 그 엽서의 보낸 사람만 올리고 지우고 고친다", () => {
    for (const verb of ["insert", "update", "delete"]) {
      const rule = policy(`postcards_files_${verb}_own`);
      expect(rule).toContain("bucket_id = 'postcards'");
      expect(rule).toMatch(/sender_id = auth\.uid\(\)/);
    }
  });

  it("누구나 읽는 정책은 없다 — 공개 버킷이라 주소(길고 무작위)를 아는 사람이 보고, API 로 목록을 훑는 것은 보낸 사람만", () => {
    expect(sql).not.toMatch(/policy "postcards_files_read/);
    const rule = policy("postcards_files_list_own");
    expect(rule).toContain("for select");
    expect(rule).toMatch(/sender_id = auth\.uid\(\)/);
  });

  it("정책 안에서 storage.objects 를 다시 읽지 않는다(재귀 방지)", () => {
    const start = sql.indexOf("-- 사진 보관함");
    expect(start).toBeGreaterThan(-1);
    // 주석(운영 메모의 검색 예시)은 빼고 본다.
    const code = sql
      .slice(start)
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(code).not.toMatch(/from storage\.objects/);
  });

  it("엽서 줄이 있어야 사진을 올릴 수 있다 — 줄 먼저, 사진은 나중(링크 공유와 같은 순서)", () => {
    expect(policy("postcards_files_insert_own")).toContain("public.postcards");
  });
});

describe("mailbox.sql · 로그인 없는 사람", () => {
  it("표 여덟 개 모두에서 anon 의 권한을 거둔다 — 받는 쪽은 함수로만 읽는다", () => {
    const revoke = sql.slice(sql.indexOf("revoke all on table"), sql.indexOf("from anon;"));
    for (const table of ["mailboxes", "mailbox_senders", "mailbox_invites", "postcard_ids", "postcards", "postcard_photos", "postcard_deliveries", "postcard_replies"]) {
      expect(revoke).toContain(`public.${table}`);
    }
  });
});

describe("mailbox.sql · 가족 공유와의 만남", () => {
  it("가족(추가도 가능)은 엽서 줄을 읽을 수 있다 — 그래야 엽서가 걸린 여행의 삭제가 멈춘다", () => {
    expect(sql).toContain('policy "postcards_select_family" on public.postcards');
    expect(sql).toMatch(/postcards_select_family[\s\S]*?family_can\(sender_id, 'full'\)/);
    expect(sql).toContain('policy "postcard_photos_select_family" on public.postcard_photos');
  });

  it("가족에게 엽서를 지우거나 만드는 길은 열지 않는다", () => {
    expect(sql).not.toMatch(/postcards_(insert|update|delete)_family/);
  });

  it("가족 공유를 아직 안 만들었어도 실행되도록 있는지 보고 건다", () => {
    expect(sql).toMatch(/to_regclass\('public\.family_links'\)/);
  });
});
