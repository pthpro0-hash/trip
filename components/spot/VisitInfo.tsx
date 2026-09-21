import type { SpotPractical } from "@/lib/types";

interface VisitInfoProps {
  practical: SpotPractical;
}

// 가기 전에 확인해야 하는 것들. 휴무일을 모르고 갔다가 헛걸음하는 게
// 여행지 앱에서 가장 나쁜 경험이라, 휴무일은 눈에 띄게 둔다.
const ROWS: { key: keyof SpotPractical; label: string }[] = [
  { key: "useTime", label: "이용시간" },
  { key: "restDate", label: "휴무일" },
  { key: "fee", label: "이용요금" },
  { key: "parking", label: "주차" },
  { key: "phone", label: "문의" },
];

export function VisitInfo({ practical }: VisitInfoProps) {
  const rows = ROWS.filter((row) => practical[row.key]);
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl bg-bg-subtle p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">이용 안내</h2>
      <dl className="mt-3 flex flex-col gap-3 text-[15px]">
        {rows.map((row) => {
          const value = practical[row.key]!;
          const isRest = row.key === "restDate";
          return (
            <div key={row.key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
              <dt className="shrink-0 text-text-faint sm:w-20">{row.label}</dt>
              <dd className={`whitespace-pre-line ${isRest ? "font-medium text-text" : "text-text"}`}>
                {row.key === "phone" ? (
                  <a href={`tel:${value.replace(/[^0-9+]/g, "")}`} className="text-accent hover:text-accent-hover">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
