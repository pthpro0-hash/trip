"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/collections";
import type { SentWish } from "@/lib/mailboxWishes";
import { spotById } from "@/lib/wishSpots";

/*
  부모님이 '가고 싶은 곳'으로 보낸 곳들 — 책장 카드 안에 보인다.

  곳마다 [곳 보기](여행 100선 상세)와 [내 찜에 담기](내 찜 목록 — 계정에 동기화된다)가 있다. 이번에 처음 본 것에는
  '새' 표시가 붙는다(화면을 열면 봤다고 적는데, 그 순간 표시까지 사라지면 무엇이 새것인지 알 수 없어서 화면이 넘겨준다).
  여행 100선에서 사라진 옛 id 는 이름 그대로 보이고 곳 보기·찜은 없다.
*/
export function WishList({ boxName, wishes, fresh }: { boxName: string; wishes: SentWish[]; fresh: Set<string> }) {
  const { ids, toggle } = useWishlist();
  if (wishes.length === 0) return null;

  return (
    <ul aria-label={`${boxName} 가고 싶은 곳`} className="flex flex-col gap-1.5 rounded-lg bg-bg-subtle p-2.5">
      {wishes.map((wish) => {
        const spot = spotById(wish.spot);
        const saved = ids.includes(wish.spot);
        return (
          <li key={wish.id} className="flex flex-wrap items-center gap-1.5 text-[14px] text-text">
            <span aria-hidden="true" className="text-[#e0245e]">
              ♥
            </span>
            <span className="min-w-0">
              {wish.who}: {spot?.name ?? wish.spot}
            </span>
            {fresh.has(wish.id) && <span className="rounded-full bg-[#d70015] px-2 py-0.5 text-[11px] font-bold text-white">새</span>}
            {spot && (
              <span className="ml-auto flex items-center gap-1.5">
                <Link
                  href={`/spots/${encodeURIComponent(spot.id)}`}
                  aria-label={`${spot.name} 곳 보기`}
                  className="rounded-full bg-bg px-3 py-1 text-[12px] font-medium text-text ring-1 ring-line hover:bg-line"
                >
                  곳 보기
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(spot.id)}
                  aria-pressed={saved}
                  aria-label={saved ? `${spot.name} 찜 빼기` : `${spot.name} 내 찜에 담기`}
                  className={`rounded-full px-3 py-1 text-[12px] font-medium transition ${
                    saved ? "bg-accent-soft text-accent" : "bg-accent text-on-accent hover:bg-accent-hover"
                  }`}
                >
                  {saved ? "찜했어요" : "내 찜에 담기"}
                </button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
