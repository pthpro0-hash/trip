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
