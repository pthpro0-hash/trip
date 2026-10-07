import type { SupabaseClient } from "@supabase/supabase-js";
import { inviteExpiresAt } from "@/lib/family";
import { resolveSettings, type MailboxSettings } from "@/lib/mailboxSettings";
import {
  GREETING_NAME_MAX,
  NAME_MAX,
  isMailboxToken,
  isPostcardId,
  newMailboxToken,
  normalizeMembers,
  type Tone,
} from "@/lib/mailbox";
import { removePostcardFiles, sweepPostcardFolder } from "./postcardCleanup";

/*
  가족 책장 — 만들고, 고치고, 링크를 바꾸고, 보내는 사람을 들인다.

  표와 규칙은 supabase/mailbox.sql 에 있다. 여기서 알아 둘 것:

    - 책장은 만든 사람(주인)만 고치고 닫는다. 보내는 사람으로 들어온 사람은 읽기만 한다
      (엽서 링크를 만들려면 책장 링크가 필요해서 읽을 수는 있다).
    - 보내는 사람 표에 직접 넣는 길은 없다 — 초대 수락 함수(accept_mailbox_invite)로만 들어온다.
    - 책장을 지우려면 먼저 닫아야 한다(닫기 → 지우기). 지울 때는 이 책장에만 보낸 엽서의 사진 파일을 먼저 모두
      치우고 줄은 나중에 지운다(deleteMailbox). 표에서 직접 지우는 길은 DB 가 막아 두었다 — 그러면 사진 복사본이
      어디에도 안 걸려 공개 보관함에 영영 남는다.
*/

export interface MailboxItem {
  id: string;
  ownerId: string;
  name: string;
  greetingName: string | null;
  useGreeting: boolean;
  tone: Tone;
  members: string[];
  /** 책장 링크의 글자. 이것을 아는 사람이 책장을 연다. */
  token: string;
  closed: boolean;
  /** 책장 설정(사진 수·크기·부모님 화면 …). 저장된 값이 없거나 틀리면 칸마다 권장값이다. */
  settings: MailboxSettings;
  /** 주인을 포함한 보내는 사람 수. */
  senderCount: number;
}

export interface MailboxList {
  /** 내가 만든 책장. */
  owned: MailboxItem[];
  /** 보내는 사람으로 들어간 남의 책장. */
  joined: MailboxItem[];
}

export interface MailboxInput {
  name: string;
  greetingName: string;
  useGreeting: boolean;
  tone: Tone;
  /** "엄마, 아빠" 같은 글. 비우면 부르는 말에서 만든다. */
  members: string;
}

export interface PendingMailboxInvite {
  token: string;
  mailboxId: string;
  expiresAt: string;
}

type Failure = { ok: false; reason: "invalid" | "limit" | "failed" };

const COLUMNS = "id,owner_id,name,greeting_name,use_greeting,tone,members,token,closed_at,settings,created_at";

/** 화면에서 받은 글을 DB 에 넣을 모양으로 다듬는다. 이름이 비었거나 길면 null. */
function clean(input: MailboxInput) {
  const name = input.name.trim();
  const greetingName = input.greetingName.trim();
  if (!name || name.length > NAME_MAX || greetingName.length > GREETING_NAME_MAX) return null;
  const members = normalizeMembers(input.members);
  return {
    name,
    greeting_name: greetingName || null,
    use_greeting: input.useGreeting,
    tone: input.tone,
    // 받는 분 이름을 안 적었으면 부르는 말에서 만든다("엄마 아빠" → 엄마, 아빠).
    members: members.length > 0 ? members : normalizeMembers(greetingName),
  };
}

/** 내 책장들. 못 읽었으면 "failed". */
export async function fetchMailboxes(supabase: SupabaseClient, userId: string): Promise<MailboxList | "failed"> {
  const [boxes, senders] = await Promise.all([
    supabase.from("mailboxes").select(COLUMNS).order("created_at", { ascending: true }),
    supabase.from("mailbox_senders").select("mailbox_id,user_id,role"),
  ]);
  if (boxes.error || !boxes.data || senders.error || !senders.data) return "failed";

  const counts = new Map<string, number>();
  for (const sender of senders.data as { mailbox_id: string }[]) {
    counts.set(sender.mailbox_id, (counts.get(sender.mailbox_id) ?? 0) + 1);
  }
  const list: MailboxList = { owned: [], joined: [] };
  for (const raw of boxes.data as Record<string, unknown>[]) {
    const item: MailboxItem = {
      id: String(raw.id),
      ownerId: String(raw.owner_id),
      name: String(raw.name),
      greetingName: typeof raw.greeting_name === "string" ? raw.greeting_name : null,
      useGreeting: raw.use_greeting !== false,
      tone: raw.tone === "polite" ? "polite" : "casual",
      members: Array.isArray(raw.members) ? raw.members.map(String) : [],
      token: String(raw.token),
      closed: raw.closed_at != null,
      settings: resolveSettings(raw.settings),
      senderCount: counts.get(String(raw.id)) ?? 1,
    };
    (item.ownerId === userId ? list.owned : list.joined).push(item);
  }
  return list;
}

/** 책장을 만든다. 책장은 3개까지. */
export async function createMailbox(
  supabase: SupabaseClient,
  ownerId: string,
  input: MailboxInput,
): Promise<{ ok: true; id: string; token: string } | Failure> {
  const values = clean(input);
  if (!values) return { ok: false, reason: "invalid" };
  const token = newMailboxToken();
  const { data, error } = await supabase
    .from("mailboxes")
    .insert({ owner_id: ownerId, token, ...values })
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: /3개/.test(error?.message ?? "") ? "limit" : "failed" };
  return { ok: true, id: String(data.id), token };
}

/** 이름·부르는 말·말투·받는 분을 고친다. 주인만 된다. */
export async function updateMailbox(
  supabase: SupabaseClient,
  id: string,
  input: MailboxInput,
): Promise<{ ok: true } | Failure> {
  const values = clean(input);
  if (!values) return { ok: false, reason: "invalid" };
  const { error } = await supabase.from("mailboxes").update(values).eq("id", id);
  return error ? { ok: false, reason: "failed" } : { ok: true };
}

/**
 * 책장 설정을 저장한다. 주인만 된다(DB 정책). 범위를 벗어난 값은 권장으로 다듬어 저장한다.
 * 새로 꽂는 책부터 적용되는 것(사진 수·크기)과 바로 적용되는 것(부모님 화면)이 섞여 있다.
 */
export async function updateMailboxSettings(
  supabase: SupabaseClient,
  id: string,
  settings: MailboxSettings,
): Promise<{ ok: true } | Failure> {
  const { error } = await supabase.from("mailboxes").update({ settings: resolveSettings(settings) }).eq("id", id);
  return error ? { ok: false, reason: "failed" } : { ok: true };
}

/** 링크를 새로 만든다. 옛 링크는 그 순간부터 열리지 않는다. 새 글자를 돌려주고, 못 했으면 "failed". */
export async function rotateMailboxToken(supabase: SupabaseClient, id: string): Promise<string | "failed"> {
  const token = newMailboxToken();
  const { error } = await supabase.from("mailboxes").update({ token }).eq("id", id);
  return error ? "failed" : token;
}

/** 닫거나 다시 연다. 닫으면 받는 쪽에 아무것도 보이지 않고 새 엽서도 보낼 수 없다. */
export async function setMailboxClosed(
  supabase: SupabaseClient,
  id: string,
  closed: boolean,
): Promise<{ ok: true } | Failure> {
  const { error } = await supabase
    .from("mailboxes")
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .eq("id", id);
  if (!error) return { ok: true };
  return { ok: false, reason: /3개/.test(error.message) ? "limit" : "failed" };
}

/** 지우면 무엇이 되나. sole 은 이 책장에만 보낸 엽서(지워진다), kept 는 다른 책장에도 보내서 남는 엽서의 수. */
export interface MailboxDeletePlan {
  sole: string[];
  kept: number;
}

/**
 * 지울 계획을 읽는다. 내 책장이 아니거나 닫혀 있지 않으면, 읽지 못했어도 null — 지울 수 없다.
 * 확인 창이 "엽서 N장이 지워져요"를 말하는 데 쓴다.
 */
export async function planMailboxDelete(supabase: SupabaseClient, id: string): Promise<MailboxDeletePlan | null> {
  try {
    const { data, error } = await supabase.rpc("mailbox_delete_plan", { box: id });
    if (error || !data || typeof data !== "object") return null;
    const raw = data as { sole?: unknown; kept?: unknown };
    return {
      sole: Array.isArray(raw.sole) ? raw.sole.filter((entry): entry is string => typeof entry === "string" && isPostcardId(entry)) : [],
      kept: typeof raw.kept === "number" && raw.kept >= 0 ? Math.floor(raw.kept) : 0,
    };
  } catch {
    return null;
  }
}

/** "files" 는 사진 파일을 다 못 치워 멈춘 것(책장은 그대로), "failed" 는 그 밖의 실패. */
export type DeleteMailboxResult = "ok" | "files" | "failed";

/**
 * 닫은 책장을 지운다. 순서는 늘 같다 — 이 책장에만 보낸 엽서의 사진 파일을 먼저 모두 치우고, 줄은 나중에 지운다.
 * 줄이 먼저 사라지면 폴더의 주인을 밝힐 길이 없어 사진이 공개 보관함에 영영 남는다. 파일을 하나라도 못 치우면 거기서
 * 멈춘다(책장도 엽서 줄도 그대로 — 다시 하면 된다).
 */
export async function deleteMailbox(supabase: SupabaseClient, id: string): Promise<DeleteMailboxResult> {
  const plan = await planMailboxDelete(supabase, id);
  if (!plan) return "failed";
  for (const postcardId of plan.sole) {
    if (!(await sweepPostcardFolder(supabase, postcardId))) return "files";
  }
  try {
    const { data, error } = await supabase.rpc("mailbox_delete", { box: id });
    return !error && data === true ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

/** 줄일 책 하나와 그 책에서 지울 사진 파일들(표지와 하트 받은 사진은 빠져 있다). */
export interface TrimBook {
  id: string;
  drop: string[];
}

export interface MailboxTrimPlan {
  books: TrimBook[];
}

const isFileName = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(value);

/**
 * 오래된 책의 사진을 줄일 계획을 읽는다 — 책장 설정의 보관 권수(최근 10권 …)를 넘은 책 가운데 지울 사진이 있는 것.
 * 내 책장이 아니거나 읽지 못하면 null(아무것도 안 보인다). 모양이 틀린 줄은 버린다.
 */
export async function planMailboxTrim(supabase: SupabaseClient, id: string): Promise<MailboxTrimPlan | null> {
  try {
    const { data, error } = await supabase.rpc("mailbox_trim_plan", { box: id });
    if (error || !data || typeof data !== "object") return null;
    const raw = (data as { books?: unknown }).books;
    const books = Array.isArray(raw)
      ? raw.flatMap((entry): TrimBook[] => {
          if (!entry || typeof entry !== "object") return [];
          const { id: postcardId, drop } = entry as { id?: unknown; drop?: unknown };
          if (typeof postcardId !== "string" || !isPostcardId(postcardId) || !Array.isArray(drop)) return [];
          const files = drop.filter(isFileName);
          return files.length > 0 ? [{ id: postcardId, drop: files }] : [];
        })
      : [];
    return { books };
  } catch {
    return null;
  }
}

export type TrimMailboxResult = { ok: true; books: number; files: number } | { ok: false; reason: "files" | "failed" };

/**
 * 오래된 책의 사진을 줄인다. 순서는 책장 지우기와 같다 — 사진 파일을 먼저 지우고 기록은 나중에 고친다. 한 책의 파일을
 * 못 지워도 나머지는 계속하고, 마지막에 기록을 고친다(서버가 파일이 정말 사라진 것만 기록에서 빼므로, 지운 만큼만
 * 맞춰진다). 못 지운 책이 있었으면 "files".
 */
export async function trimMailbox(supabase: SupabaseClient, id: string): Promise<TrimMailboxResult> {
  const plan = await planMailboxTrim(supabase, id);
  if (!plan) return { ok: false, reason: "failed" };
  if (plan.books.length === 0) return { ok: true, books: 0, files: 0 };

  let stuck = false;
  for (const book of plan.books) {
    if (!(await removePostcardFiles(supabase, book.id, book.drop))) stuck = true;
  }

  try {
    const { data, error } = await supabase.rpc("mailbox_trim_apply", { box: id, cards: plan.books.map((book) => book.id) });
    if (error || typeof data !== "number") return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (stuck) return { ok: false, reason: "files" };
  return { ok: true, books: plan.books.length, files: plan.books.reduce((sum, book) => sum + book.drop.length, 0) };
}

/** 보내는 사람으로 들어간 책장에서 나간다(내 줄 하나만). */
export async function leaveMailbox(supabase: SupabaseClient, mailboxId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from("mailbox_senders").delete().eq("mailbox_id", mailboxId).eq("user_id", userId);
  return !error;
}

/** 보내는 사람 초대를 만든다. 링크에 들어갈 글자를 돌려주고, 못 만들면 "failed". */
export async function createMailboxInvite(
  supabase: SupabaseClient,
  mailboxId: string,
  userId: string,
  now: Date = new Date(),
): Promise<string | "failed"> {
  const token = newMailboxToken();
  const { error } = await supabase.from("mailbox_invites").insert({
    token,
    mailbox_id: mailboxId,
    created_by: userId,
    expires_at: inviteExpiresAt(now).toISOString(),
  });
  return error ? "failed" : token;
}

/** 아직 쓸 수 있는 내 초대들. */
export async function fetchMailboxInvites(
  supabase: SupabaseClient,
  userId: string,
): Promise<PendingMailboxInvite[] | "failed"> {
  const { data, error } = await supabase
    .from("mailbox_invites")
    .select("token,mailbox_id,expires_at")
    .eq("created_by", userId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) return "failed";
  return (data as { token: string; mailbox_id: string; expires_at: string }[]).map((row) => ({
    token: row.token,
    mailboxId: row.mailbox_id,
    expiresAt: row.expires_at,
  }));
}

/** 아직 수락되지 않은 초대를 거둔다. */
export async function cancelMailboxInvite(supabase: SupabaseClient, token: string): Promise<boolean> {
  const { error } = await supabase.from("mailbox_invites").delete().eq("token", token);
  return !error;
}

export type AcceptMailboxResult =
  | { ok: true; mailboxId: string }
  | { ok: false; reason: "missing" | "used" | "expired" | "closed" | "full" | "login" | "failed" };

function reasonOf(message: string): Extract<AcceptMailboxResult, { ok: false }>["reason"] {
  if (message.includes("없는 초대")) return "missing";
  if (message.includes("이미 쓴")) return "used";
  if (message.includes("만료")) return "expired";
  if (message.includes("닫힌")) return "closed";
  if (message.includes("8명")) return "full";
  if (message.includes("로그인")) return "login";
  return "failed";
}

/** 초대 링크의 글자로 보내는 사람이 된다. 로그인한 사람이 부른다. */
export async function acceptMailboxInvite(supabase: SupabaseClient, token: string): Promise<AcceptMailboxResult> {
  // 모양이 틀린 글자는 DB 에 묻지 않는다.
  if (!isMailboxToken(token)) return { ok: false, reason: "missing" };
  const { data, error } = await supabase.rpc("accept_mailbox_invite", { invite_token: token });
  if (error) return { ok: false, reason: reasonOf(error.message) };
  return typeof data === "string" ? { ok: true, mailboxId: data } : { ok: false, reason: "failed" };
}
