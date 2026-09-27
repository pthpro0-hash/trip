import { collagePicks } from "@/lib/collage";
import { shapesOfShare, type ShareSnapshot } from "@/lib/share";
import { SketchCard } from "@/components/sketch/SketchCard";
import { CollageCard } from "@/components/sketch/CollageCard";
import { LineCard } from "@/components/sketch/LineCard";
import { SidoCard } from "@/components/sketch/SidoCard";

/*
  스냅샷 한 장을 카드로.

  링크를 만들기 전 미리보기와, 남이 여는 링크 페이지가 같은 것을 그린다.
  미리보기에서 본 것이 곧 남이 볼 것이어야 한다.

  사진은 부르는 쪽이 준다. 미리보기는 이미 받아 둔 그림 글자를, 링크
  페이지는 공개 보관함 주소를 준다.
*/

interface SharedCardProps {
  snapshot: ShareSnapshot;
  /** 파일 이름 → 그릴 주소. 없으면 그 자리는 빈 칸이나 점으로 남는다. */
  photos: Map<string, string>;
}

export function SharedCard({ snapshot, photos }: SharedCardProps) {
  const { stats, headline, year, months } = snapshot;
  const title = `${year}년`;

  if (snapshot.card === "sido") {
    return (
      <SidoCard
        sketch={stats}
        year={year}
        headline={headline}
        sido={snapshot.story.sido}
        firstSido={snapshot.story.firstSido}
      />
    );
  }

  const shapes = shapesOfShare(snapshot);
  if (snapshot.card === "line") {
    return <LineCard sketch={stats} shapes={shapes} year={year} headline={headline} months={months} />;
  }
  if (snapshot.card === "collage") {
    return (
      <CollageCard
        sketch={stats}
        title={title}
        headline={headline}
        picks={collagePicks(shapes.dots)}
        photos={photos}
      />
    );
  }
  return (
    <SketchCard
      sketch={stats}
      shapes={shapes}
      title={title}
      headline={headline}
      months={months}
      region={null}
      photos={photos}
    />
  );
}
