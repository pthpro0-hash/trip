import Link from "next/link";

/**
 * 보내는 사람이 부모님 화면을 미리 보는 중이라는 띠. 무엇이 가지 않는지 말해 준다.
 *
 * 부모님이 열어 본 엽서가 없으면 책꽂이·작년 오늘·올해의 책이 비어 있다. 그래서 '모든 엽서를 열어 본 것처럼'(all)
 * 보는 방식이 있고, 띠의 링크로 그것과 '지금 부모님이 보시는 대로'를 오간다(toggle).
 */
export function PreviewBanner({ all = false, toggle }: { all?: boolean; toggle?: { href: string } }) {
  return (
    <div
      role="note"
      aria-label="미리보기"
      className="flex flex-col gap-1.5 rounded-2xl bg-[#fff3cd] px-4 py-3 text-[14px] leading-relaxed text-[#6b4e00]"
    >
      <p>
        <strong className="font-bold">미리보기예요</strong> — 부모님께는 아무 표시도 가지 않아요. 열어 봤다는 표시도, 답장도,
        하트도 보내지 않아요.
      </p>
      {all && <p>모든 엽서를 열어 본 것처럼 보여 드려요. 책꽂이·작년 오늘·올해의 책을 확인해 보세요.</p>}
      {toggle && (
        <Link href={toggle.href} className="self-start font-semibold underline underline-offset-4">
          {all ? "지금 부모님이 보시는 대로 보기" : "모든 엽서를 열어 본 것처럼 보기 (책꽂이 확인)"}
        </Link>
      )}
      <Link href="/mailboxes" className="self-start font-semibold underline underline-offset-4">
        ← 내 우편함으로
      </Link>
    </div>
  );
}
