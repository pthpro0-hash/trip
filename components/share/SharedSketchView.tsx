import Link from "next/link";
import { storyOfShare, type ShareSnapshot } from "@/lib/share";
import { publicFileUrl } from "@/lib/supabase/shares";
import { StoryScenes } from "@/components/sketch/StoryScenes";
import { SharedCard } from "./SharedCard";

/*
  링크로 받은 한 장의 본문. 서버에서 그린다 — 카드가 통째로 SVG 라
  받자마자 보이고, 장면만 브라우저에서 이어받는다(사진 크게 보기).

  사진은 링크 보관함의 공개 주소로 건다. 여행 사진 보관함에는 닿지 않는다.
*/

interface SharedSketchViewProps {
  id: string;
  snapshot: ShareSnapshot;
}

export function SharedSketchView({ id, snapshot }: SharedSketchViewProps) {
  const photos = new Map(snapshot.files.map((file) => [file, publicFileUrl(id, file)]));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-5 pb-16 pt-8">
      <header className="flex flex-col gap-2">
        <p className="text-[14px] font-semibold text-text-faint">{snapshot.year}년 여행 스케치</p>
        <h1 className="text-[24px] font-bold leading-snug tracking-tight text-text md:text-[28px]">
          {snapshot.headline}
        </h1>
      </header>

      <div className="overflow-hidden rounded-2xl ring-1 ring-line">
        <SharedCard snapshot={snapshot} photos={photos} />
      </div>

      <StoryScenes story={storyOfShare(snapshot)} photoUrls={photos} shared />

      {/*
        받은 사람이 "나도"라고 느끼는 자리. 이 한 장이 어떻게 만들어졌는지
        한 줄로 알려 주고 바로 시작하게 한다.
      */}
      <section className="mt-2 flex flex-col gap-3 rounded-2xl bg-bg-subtle p-6">
        <p className="text-[18px] font-bold tracking-tight text-text">나도 한 해를 한 장으로</p>
        <p className="text-[15px] leading-relaxed text-text-muted">
          여행 사진만 고르면, 다녀온 곳이 지도 위에 저절로 그려지고 한 해가 이런 한 장이 돼요.
        </p>
        <Link
          href="/?v=sketch"
          className="self-start rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-on-accent transition hover:bg-accent-hover"
        >
          내 여행 스케치 시작하기
        </Link>
      </section>
    </main>
  );
}
