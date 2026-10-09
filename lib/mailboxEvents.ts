/**
 * 답장·하트를 "봤다"고 표시했음을 위 띠에 알리는 신호(window 이벤트 이름).
 *
 * 책장 화면과 여행 상세가 같은 일을 하므로(둘 다 보여 주는 순간 봤다고 적는다) 화면 부품이 아니라 여기에 둔다 —
 * 위 띠의 새 소식 표시(MailboxBell)가 이 신호를 듣고 다시 센다.
 */
export const REPLIES_SEEN = "postcard-replies-seen";
