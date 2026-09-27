"use client";

/*
  칠한 곳. 17개 시도 중 몇 곳을 밟았는지.

  빈칸이 보이면 채우고 싶어진다. 밟은 시도는 채워서, 안 밟은 시도는
  점선으로 비워서 늘어놓는다. 밟은 곳을 누르면 그곳 여행으로, 안 밟은
  곳을 누르면 그 시도로 날아가 100선을 겹쳐 보인다 — 다음에 갈 곳이
  거기 있다.
*/

export { SIDO_ORDER } from "@/lib/sidoOrder";
import { SIDO_ORDER } from "@/lib/sidoOrder";

interface CollectionPanelProps {
  /** 시도마다 다녀온 곳 수. */
  tally: Map<string, number>;
  /** 기간을 골랐으면 그 기간. 무엇을 센 것인지 밝힌다. */
  rangeText: string | null;
  /** 밟은 100선 수. */
  curatedVisited: number;
  curatedTotal: number;
  onSido: (name: string, visited: boolean) => void;
}

export function CollectionPanel({
  tally,
  rangeText,
  curatedVisited,
  curatedTotal,
  onSido,
}: CollectionPanelProps) {
  const visited = SIDO_ORDER.filter((name) => tally.has(name)).length;

  return (
    <div className="flex flex-col gap-4">
      {/* 오른쪽 위는 창의 닫기 단추 자리다. */}
      <div className="pr-10">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-text">
            17개 시도 중 {visited}곳
          </h2>
          <p className="mt-0.5 text-[13px] text-text-muted">
            {rangeText ? `${rangeText}에 밟은 곳 · ` : ""}한국관광 100선 {curatedTotal}곳 중 {curatedVisited}곳
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {SIDO_ORDER.map((name) => {
          const count = tally.get(name) ?? 0;
          const on = count > 0;
          return (
            <li key={name}>
              <button
                type="button"
                onClick={() => onSido(name, on)}
                aria-label={on ? `${name} ${count}곳 다녀옴` : `${name} 아직 안 가 봄`}
                className={`flex h-14 w-full flex-col items-center justify-center rounded-xl text-center transition ${
                  on
                    ? "bg-accent-soft text-accent hover:brightness-95"
                    : "border border-dashed border-line-strong text-text-faint hover:bg-bg-subtle hover:text-text-muted"
                }`}
              >
                <span className="text-[14px] font-semibold">{name}</span>
                <span className="text-[11px]">{on ? `${count}곳` : "아직"}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-[13px] leading-relaxed text-text-faint">
        안 가 본 시도를 누르면 그리로 날아가 100선을 겹쳐 보여 드려요.
      </p>
    </div>
  );
}
