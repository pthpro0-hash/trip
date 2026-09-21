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

/** 가기 전에 확인해야 하는 것들. 여행지마다 있는 항목이 다르다. */
export interface SpotPractical {
  useTime?: string;
  restDate?: string;
  fee?: string;
  parking?: string;
  phone?: string;
}

/** 한국관광공사 TourAPI에서 가져온 사진·공식 소개글. lib/data/spot-media.json */
export interface SpotMedia {
  contentId: string;
  sourceTitle: string;
  /** 시·군·구와 읍·면·동까지 담긴 도로명 주소. */
  address: string;
  overview: string;
  homepage: string | null;
  practical: SpotPractical;
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
