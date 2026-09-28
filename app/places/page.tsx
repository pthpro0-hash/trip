import type { Metadata } from "next";
import { PlaceVisits } from "@/components/place/PlaceVisits";

/*
  같은 이름으로 다녀온 때를 모아 보는 화면. 여행 상세에서 곳 이름을
  누르면 온다(/places?name=안목해변). 내 기록이라 검색에는 나오지 않는다.
*/

type Props = { searchParams: Promise<{ name?: string | string[] }> };

const nameOf = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim().slice(0, 80) : "");

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const name = nameOf((await searchParams).name);
  return { title: name || "다녀온 곳", robots: { index: false, follow: false } };
}

export default async function PlacesPage({ searchParams }: Props) {
  const name = nameOf((await searchParams).name);
  // 이름이 바뀌면 처음부터 다시 모은다.
  return <PlaceVisits key={name} name={name} />;
}
