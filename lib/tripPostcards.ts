import type { SentReply, TripPostcardLine } from "./supabase/postcards";

/*
  여행 상세가 보여 주는 보낸 엽서 줄(받는 곳마다)에 대한 순수한 계산.

  supabase 를 부르는 것은 lib/supabase/postcards 가 하고, 여기는 읽어 온 줄에서 무엇이 새것인지, 같은 말이 몇 번인지만 가린다.
*/

/**
 * 이 줄들에서 보낸 사람이 아직 못 본 답장·하트의 id. 여행 상세가 줄을 보여 주는 순간 "봤다"고 적고(위 띠의 새 소식 표시도
 * 따라 꺼진다), 이번에 처음 본 것에는 '새 답장'·'새 하트' 표시를 붙인다.
 */
export function unseenReactions(lines: TripPostcardLine[]): { replies: string[]; hearts: string[] } {
  return {
    replies: lines.flatMap((line) => line.replies.filter((reply) => !reply.seen).map((reply) => reply.id)),
    hearts: lines.flatMap((line) => line.hearts.filter((heart) => !heart.seen).map((heart) => heart.id)),
  };
}

/** 같은 사람이 같은 말로 남긴 답장들을 한 덩어리로 — 몇 번 눌렀는지와 그 답장들의 id. */
export interface ReplyGroup {
  who: string;
  reaction: string;
  count: number;
  /** 이 덩어리에 든 답장 행들의 id — 하나라도 처음 본 것이면 '새 답장'을 붙인다. */
  ids: string[];
}

/**
 * 답장을 (누가, 무슨 말)마다 한 줄로 모은다. 받는 쪽은 답장 단추를 눌러도 잠기지 않아서, 보내졌는지 못 미더운 부모님이 같은
 * 단추를 서너 번 누르시면 보낸 사람 화면에 똑같은 줄과 '새 답장' 표시가 서너 개 쌓인다. 처음 나온 차례를 지킨다.
 */
export function groupReplies(replies: SentReply[]): ReplyGroup[] {
  const groups: ReplyGroup[] = [];
  for (const reply of replies) {
    const group = groups.find((entry) => entry.who === reply.who && entry.reaction === reply.reaction);
    if (group) {
      group.count += 1;
      group.ids.push(reply.id);
    } else {
      groups.push({ who: reply.who, reaction: reply.reaction, count: 1, ids: [reply.id] });
    }
  }
  return groups;
}
