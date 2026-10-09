/**
 * 다른 주소로 떠난다(페이지를 통째로 새로 연다).
 *
 * 로그인처럼 서비스 밖(카카오 등)을 거쳐 돌아오는 길은 라우터가 아니라 브라우저가 직접 가야 한다. 창의 location 은 시험에서 바꿀 수
 * 없어서, 떠나는 일을 한 곳에 두고 시험이 갈아 끼운다.
 */
export function goTo(href: string): void {
  window.location.assign(href);
}
