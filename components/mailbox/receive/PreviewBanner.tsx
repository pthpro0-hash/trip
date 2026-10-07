import Link from "next/link";

/** 보내는 사람이 부모님 화면을 미리 보는 중이라는 띠. 무엇이 가지 않는지 말해 준다. */
export function PreviewBanner() {
  return (
    <div
      role="note"
      aria-label="미리보기"
      className="flex flex-col gap-1 rounded-2xl bg-[#fff3cd] px-4 py-3 text-[14px] leading-relaxed text-[#6b4e00]"
    >
      <p>
        <strong className="font-bold">미리보기예요</strong> — 부모님께는 아무 표시도 가지 않아요. 열어 봤다는 표시도, 답장도,
        하트도 보내지 않아요.
      </p>
      <Link href="/mailboxes" className="self-start font-semibold underline underline-offset-4">
        ← 내 우편함으로
      </Link>
    </div>
  );
}
