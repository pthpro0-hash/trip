import type { FootprintStep } from "./footprint";

/*
  인쇄용 책(올해의 책 → PDF)의 쪽 나누기. 쪽 크기는 A5 세로(148×210mm)이고, 쪽에 무엇이 몇 개 들어가는지는 여기서 정한다.
  여행 한 번은 첫 쪽(제목·인사말·곳 목록 + 사진 여섯 장)과 둘째 쪽(사진 열다섯 장)에 담는다 — 엽서 하나의 사진은
  최대 스무 장(POSTCARD_PHOTOS_MAX)이라 두 쪽 안에 모두 들어간다.
*/

/** 여행의 첫 쪽에 들어가는 사진 수(2열×3줄). */
export const FIRST_PAGE_PHOTOS = 6;
/** 둘째 쪽에 들어가는 사진 수(3열×5줄). */
export const REST_PAGE_PHOTOS = 15;
/** 지도 쪽 곳 목록에 적는 최대 곳 수. 더 많으면 '외 N곳'. */
export const LEGEND_MAX = 30;

export function splitTripPhotos(files: string[]): { first: string[]; rest: string[] } {
  return {
    first: files.slice(0, FIRST_PAGE_PHOTOS),
    rest: files.slice(FIRST_PAGE_PHOTOS, FIRST_PAGE_PHOTOS + REST_PAGE_PHOTOS),
  };
}

export interface LegendRow {
  n: number;
  name: string;
  when: string;
}

/** 지도의 점 번호(1부터, 찍는 차례)와 같은 번호로 곳 이름과 날짜를 적는다. */
export function legendOf(steps: FootprintStep[]): { rows: LegendRow[]; more: number } {
  const rows = steps.slice(0, LEGEND_MAX).map((step, index) => ({
    n: index + 1,
    name: step.placeName,
    when: step.day ? `${step.month}월 ${step.day}일` : `${step.month}월`,
  }));
  return { rows, more: Math.max(0, steps.length - LEGEND_MAX) };
}
