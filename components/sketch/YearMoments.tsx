import type { Moment } from "@/lib/sketchMoments";

/*
  올해의 순간 — 한장 요약 카드 아래의 작은 줄. 기록에서 계산한 것을 그대로 보여 줄 뿐이라 설명 문장은 없다.
  순간이 둘 미만이면 줄 자체를 두지 않는다(하나만 덩그러니 있으면 허전하다).
*/
export function YearMoments({ moments }: { moments: Moment[] }) {
  if (moments.length < 2) return null;
  return (
    <section aria-label="올해의 순간" className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold text-text-muted">올해의 순간</h3>
      <ul className="grid gap-2 sm:grid-cols-3">
        {moments.map((moment) => (
          <li key={moment.key} className="rounded-2xl bg-bg-subtle px-4 py-3">
            <p className="text-[12px] text-text-faint">{moment.label}</p>
            <p className="mt-0.5 break-keep text-[18px] font-bold tracking-tight text-text">{moment.value}</p>
            <p className="mt-0.5 break-keep text-[12px] text-text-muted">{moment.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
