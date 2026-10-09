import type { TripPostcardLine } from "./supabase/postcards";

/*
  여행 상세가 보여 주는 보낸 엽서 줄(받는 곳마다)에 대한 순수한 계산.

  supabase 를 부르는 것은 lib/supabase/postcards 가 하고, 여기는 읽어 온 줄에서 무엇이 새것인지만 가린다.
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
