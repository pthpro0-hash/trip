/*
  카드 세 모양(지도·사진 콜라주·선 그림)이 함께 쓰는 판과 먹.

  크기가 같아야 저장·스토리용 세로 변환이 모양과 상관없이 똑같이 된다.
  글꼴은 시스템 것을 쓴다 — 저장본을 만들 때 바깥 글꼴은 따라오지 않는다.
*/

export const CARD_WIDTH = 720;
export const CARD_HEIGHT = 1060;
/** 좌우 여백. 제목·그림·숫자가 모두 이 선에 맞춰 선다. */
export const CARD_MARGIN = 48;

export const INK = "#1d1d1f";
export const MUTED = "#6e6e73";
export const FAINT = "#a1a1a6";
export const FONT =
  "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard Variable', Pretendard, sans-serif";

/** 선 그림 카드의 종이. 스토리용 세로 바탕도 이 색으로 칠한다. */
export const PAPER = "#f6f2e9";

/** 카드 맨 아래 서명. */
export const SIGNATURE = "나만의 여행 스케치";
