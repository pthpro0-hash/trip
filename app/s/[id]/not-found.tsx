import Link from "next/link";

/* 끊긴 링크. 누가 끊었는지, 왜인지는 말하지 않는다 — 그건 만든 사람의 일이다. */
export default function SharedSketchNotFound() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 pb-16 pt-16 text-center">
      <p className="text-[20px] font-bold tracking-tight text-text">볼 수 없는 링크예요</p>
      <p className="text-[15px] leading-relaxed text-text-muted">
        링크가 끊겼거나 주소가 잘못되었어요. 보내 준 분께 다시 물어봐 주세요.
      </p>
      <Link
        href="/?v=sketch"
        className="self-center rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
      >
        내 여행 스케치 시작하기
      </Link>
    </main>
  );
}
