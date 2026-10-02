import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "열리지 않는 링크",
  robots: { index: false, follow: false },
};

/*
  가족 우편함 링크가 열리지 않을 때. 링크가 틀렸거나, 보낸 분이 링크를 새로 만들었거나, 우편함을 닫았거나,
  엽서를 거두었을 때다. 어르신이 보는 화면이라 이유를 짐작해 주고 다음에 할 일을 한 줄로 말한다.
  코드·오류 문구는 보이지 않는다.
*/
export default function MailboxNotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p aria-hidden="true" className="text-[56px]">
        ✉️
      </p>
      <h1 className="text-[28px] font-bold tracking-tight text-text">이 링크는 지금 열리지 않아요</h1>
      <p className="text-[19px] leading-relaxed text-text-muted">
        보낸 가족이 링크를 새로 만들었거나 엽서를 거두었을 수 있어요. 가족에게 새 링크를 보내 달라고 해 주세요.
      </p>
    </main>
  );
}
