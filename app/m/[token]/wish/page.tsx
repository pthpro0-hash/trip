import { redirect } from "next/navigation";
import { isPreview, mailboxPath } from "@/lib/mailbox";

/*
  옛 주소.

  가족 사진첩 · 가고 싶은 곳 보내기(부모님이 여행 100선에서 고른 곳을 가족에게 보내던 화면)는 쓰는 사람에게 복잡하기만
  해서 뺐다(2026-10-14). 이 주소로 들어오면 그 사진첩의 처음으로 넘긴다.
*/

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
};

export default async function WishPage({ params, searchParams }: Props): Promise<never> {
  const { token } = await params;
  redirect(mailboxPath(token, isPreview((await searchParams).preview)));
}
