import type { SupabaseClient } from "@supabase/supabase-js";

/*
  그해의 한 줄.

  스케치 맨 위 문장은 센 값에서 지어 낸다 — "열세 번 길을 나선 해".
  쓸 만하지만 그 사람이 기억하는 말은 따로 있다. "민수랑 처음 바다 본 해"
  같은 것.

  자동은 제안, 확정은 사람. 제목에도 부제에도 장소 이름에도 지켜 온
  규칙인데 정작 가장 크게 적히는 이 줄만 못 고치고 있었다.
*/

/** 해마다 적어 둔 한 줄. 적지 않은 해는 아예 나오지 않는다. */
export async function fetchHeadlines(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from("sketch_years")
    .select("year,headline")
    .eq("user_id", userId);

  if (error || !data) return new Map();
  return new Map(data.map((row) => [Number(row.year), String(row.headline)]));
}

/**
 * 그해의 한 줄을 적어 둔다. 비우면 지운다 — 그러면 화면이 다시
 * 지어 낸 말로 돌아간다.
 */
export async function saveHeadline(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  headline: string,
): Promise<boolean> {
  const line = headline.trim();

  if (line.length === 0) {
    const { error } = await supabase
      .from("sketch_years")
      .delete()
      .eq("user_id", userId)
      .eq("year", year);
    return !error;
  }

  // 같은 해를 다시 적으면 덮어쓴다.
  const { error } = await supabase
    .from("sketch_years")
    .upsert({ user_id: userId, year, headline: line }, { onConflict: "user_id,year" });

  return !error;
}
