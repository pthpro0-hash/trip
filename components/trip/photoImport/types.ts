/** 기록을 마친 결과. 완료 화면이 이것으로 무엇이 되었는지 말한다. */
export interface SaveOutcome {
  /** 새로 기록한 여행. */
  saved: number;
  /** 이미 같은 날짜의 기록이 있어 건너뛴 여행. */
  skipped: number;
  /** 저장하지 못한 여행. */
  failed: number;
  /** 함께 올라간 사진 수. */
  photos: number;
  /** 이 브라우저가 열지 못해 올리지 못한 사진(파일 이름). */
  unsupported: string[];
  /** 보관할 수 있는 수를 넘어 올리지 못한 사진 수. */
  overLimit: number;
}

/** 확인 화면에서 한 방문(들른 곳) 줄에 필요한 것. */
export interface VisitLine {
  id: number;
  title: string;
  /** 여행 100선에 있는 곳인가. */
  curated: boolean;
  /** "09-13 09:21~09:27 · 2장". */
  when: string;
  /** 이 방문 앞에서 날이 바뀌고 멀리 떨어졌다면, 거기서 여행을 둘로 나눌 수 있다. */
  cut?: { day: string; km: number };
}
