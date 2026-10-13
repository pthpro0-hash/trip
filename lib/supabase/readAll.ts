/*
  표의 줄을 끝까지 읽는다.

  데이터 서버는 한 번에 1000줄까지만 준다. 한 번에 읽는 코드는 줄이 천을 넘는 날부터 조용히 앞의 1000줄만 받는다 — 사진이 1186장이 되자
  내 여행 지도에 최근 여행의 사진이 안 뜬 것이 이 때문이었다. 사진·방문·여행처럼 쓰는 사람의 기록이 늘수록 불어나는 표를 읽을 때는
  이것으로 나눠 읽는다. 순서가 정해져 있어야 나눠 읽을 때 줄이 빠지거나 겹치지 않는다 — 부르는 쪽이 `.order()` 를 걸고(같은 값이
  많은 칸이면 id 까지) 이 함수에 구간을 읽는 일을 넘긴다.
*/
export const ROWS_PER_PAGE = 1000;

interface Page<T> {
  data: T[] | null;
  error: unknown;
}

/** 한 구간을 읽는 일. from~to 는 양 끝을 포함한다. */
export type ReadRange<T> = (from: number, to: number) => PromiseLike<Page<T>>;

/** 끝까지 읽는다. 어느 구간이든 못 읽으면 null(반쯤 읽은 것을 전부인 양 돌려주지 않는다). */
export async function readAll<T>(read: ReadRange<T>): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += ROWS_PER_PAGE) {
    const { data, error } = await read(from, from + ROWS_PER_PAGE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < ROWS_PER_PAGE) return rows;
  }
}
