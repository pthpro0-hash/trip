export type Region = "수도권" | "강원권" | "충청권" | "전라권" | "경상권" | "제주권";
export type Season = "봄" | "여름" | "가을" | "겨울" | "사계절";
export type Theme =
  | "역사유적"
  | "자연경관"
  | "테마파크"
  | "해변"
  | "야경"
  | "체험마을"
  | "정원"
  | "섬";

export interface SpotImage {
  url: string;
  /** TourAPI 저작권 유형 (Type1 출처표시, Type3 출처표시+변경금지). */
  copyright: string;
}

/** 한국관광공사 TourAPI에서 가져온 사진·공식 소개글. lib/data/spot-media.json */
export interface SpotMedia {
  contentId: string;
  sourceTitle: string;
  overview: string;
  homepage: string | null;
  images: SpotImage[];
}

export interface Spot {
  id: string;
  name: string;
  region: Region;
  lat: number;
  lng: number;
  summary: string;
  highlights: string[];
  seasons: Season[];
  seasonNote?: string;
  specialty: string[];
  foods: string[];
  themes: Theme[];
}
