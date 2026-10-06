import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSettings, type MailboxSettings } from "@/lib/mailboxSettings";
import { isMailboxToken, isPostcardId, isPostcardSnapshot, type PostcardSnapshot, type Tone } from "@/lib/mailbox";
import { SUPABASE_URL } from "./config";
import { POSTCARD_BUCKET } from "./postcardCleanup";

/*
  가족 우편함 · 받는 쪽(로그인 없음)이 읽고 답하는 길.

  받는 쪽은 표를 읽지 못하고, 링크의 글자를 받아 그 우편함 것만 돌려주는 함수(RPC)만 쓴다
  (supabase/mailbox.sql). 내려받은 것은 보낸 사람의 브라우저가 적은 것이라 모양을 확인하고, 모르는
  모양은 그리지 않는다. 모르는 링크·닫힌 우편함·오류는 모두 null — 화면은 "열리지 않는 링크"를 보인다.
*/

/** 엽서 보관함 파일의 공개 주소. 이름은 한 칸으로 묶어 "../" 같은 것이 섞여도 폴더 밖을 못 가리킨다. */
export function postcardFileUrl(postcardId: string, file: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${POSTCARD_BUCKET}/${encodeURIComponent(postcardId)}/${encodeURIComponent(file)}`;
}

export interface Reply {
  who: string;
  reaction: string;
}

export interface InboxCard {
  id: string;
  senderName: string;
  title: string | null;
  startedOn: string;
  /** 첫 사진 파일 이름. 사진이 없으면 null. */
  cover: string | null;
  /** 책(엽서)에 든 사진 수. */
  photoCount: number;
  greeting: string;
  sentAt: string;
  /** 받는 분이 열어 봤는가. */
  opened: boolean;
  replies: Reply[];
}

export interface MailboxView {
  tone: Tone;
  /** 부모님 화면 설정(글씨 크기·답장 문구 …). 칸마다 확인해 읽는다. */
  settings: MailboxSettings;
  /** 받는 분 이름들("엄마", "아빠"). */
  members: string[];
  postcards: InboxCard[];
}

export interface ReceivedPostcard {
  id: string;
  senderName: string;
  snapshot: PostcardSnapshot;
  greeting: string;
  sentAt: string;
  tone: Tone;
  settings: MailboxSettings;
  members: string[];
  replies: Reply[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isString) : []);
const toneOf = (value: unknown): Tone => (value === "polite" ? "polite" : "casual");

function repliesOf(value: unknown): Reply[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) =>
    isRecord(raw) && isString(raw.who) && isString(raw.reaction) ? [{ who: raw.who, reaction: raw.reaction }] : [],
  );
}

function cardOf(raw: unknown): InboxCard | null {
  if (!isRecord(raw) || !isString(raw.id) || !isPostcardId(raw.id) || !isString(raw.senderName)) return null;
  return {
    id: raw.id,
    senderName: raw.senderName,
    title: isString(raw.title) ? raw.title : null,
    startedOn: isString(raw.startedOn) ? raw.startedOn : "",
    cover: isString(raw.cover) && /^[A-Za-z0-9._-]{1,80}$/.test(raw.cover) ? raw.cover : null,
    // 사진 수를 못 받았으면(옛 SQL) 대표 사진이 있으면 1장으로 본다.
    photoCount: typeof raw.photoCount === "number" && raw.photoCount >= 0 ? Math.floor(raw.photoCount) : isString(raw.cover) ? 1 : 0,
    greeting: isString(raw.greeting) ? raw.greeting : "",
    sentAt: isString(raw.sentAt) ? raw.sentAt : "",
    opened: raw.openedAt != null,
    replies: repliesOf(raw.replies),
  };
}

/** 우편함 첫 화면: 받은 엽서 목록. 모르는 링크·닫힌 우편함이면 null. */
export async function fetchMailboxView(supabase: SupabaseClient, token: string): Promise<MailboxView | null> {
  if (!isMailboxToken(token)) return null;
  const { data, error } = await supabase.rpc("mailbox_view", { box_token: token });
  if (error || !isRecord(data)) return null;
  const cards = Array.isArray(data.postcards) ? data.postcards.map(cardOf).filter((card): card is InboxCard => card !== null) : [];
  return { tone: toneOf(data.tone), settings: resolveSettings(data.settings), members: strings(data.members), postcards: cards };
}

/** 엽서 한 장. 그 우편함에 없는 엽서·모양이 틀린 스냅샷이면 null. */
export async function fetchMailboxPostcard(
  supabase: SupabaseClient,
  token: string,
  postcardId: string,
): Promise<ReceivedPostcard | null> {
  if (!isMailboxToken(token) || !isPostcardId(postcardId)) return null;
  const { data, error } = await supabase.rpc("mailbox_postcard", { box_token: token, card_id: postcardId });
  if (error || !isRecord(data) || !isString(data.id) || !isString(data.senderName)) return null;
  if (!isPostcardSnapshot(data.snapshot)) return null;
  const mailbox = isRecord(data.mailbox) ? data.mailbox : {};
  return {
    id: data.id,
    senderName: data.senderName,
    snapshot: data.snapshot,
    greeting: isString(data.greeting) ? data.greeting : "",
    sentAt: isString(data.sentAt) ? data.sentAt : "",
    tone: toneOf(mailbox.tone),
    settings: resolveSettings(mailbox.settings),
    members: strings(mailbox.members),
    replies: repliesOf(data.replies),
  };
}

/** 열어 봤다고 적는다. 사람이 화면을 연 뒤 화면이 부른다(미리보기 기계가 읽어도 찍히지 않게). 실패해도 조용히. */
export async function markPostcardOpened(supabase: SupabaseClient, token: string, postcardId: string): Promise<void> {
  if (!isMailboxToken(token) || !isPostcardId(postcardId)) return;
  try {
    await supabase.rpc("mailbox_open", { box_token: token, card_id: postcardId });
  } catch {
    // 열어 본 표시가 안 찍혀도 엽서는 보인다.
  }
}

export type ReplyResult = { ok: true } | { ok: false; reason: "invalid" | "closed" | "often" | "failed" };

/** 답장 한 번. 이름은 10자, 답장은 30자까지. */
export async function replyToPostcard(
  supabase: SupabaseClient,
  token: string,
  postcardId: string,
  who: string,
  reaction: string,
): Promise<ReplyResult> {
  if (!isMailboxToken(token) || !isPostcardId(postcardId)) return { ok: false, reason: "invalid" };
  if (who.length < 1 || who.length > 10 || reaction.length < 1 || reaction.length > 30) return { ok: false, reason: "invalid" };
  try {
    const { data, error } = await supabase.rpc("mailbox_reply", {
      box_token: token,
      card_id: postcardId,
      reply_who: who,
      reply_reaction: reaction,
    });
    if (error) return { ok: false, reason: error.message.includes("잦다") ? "often" : "failed" };
    return data === true ? { ok: true } : { ok: false, reason: "closed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
