import type { Moment } from "@/lib/sketchMoments";

/*
  올해의 순간 — 한장 요약 카드 아래의 한 줄. 기록에서 계산한 것을 그대로 보여 줄 뿐이다. 칸을 셋 늘어놓을 만큼의 정보가 아니라
  한 줄로 잇고, 좁으면 줄이 바뀐다. 순간이 둘 미만이면 줄 자체를 두지 않는다(하나만 덩그러니 있으면 허전하다).
*/
export function YearMoments({ moments }: { moments: Moment[] }) {
  if (moments.length < 2) return null;
  return (
    <p aria-label="올해의 순간" className="break-keep text-[13px] leading-relaxed text-text-muted">
      <span className="font-semibold text-text">올해의 순간</span>
      {moments.map((moment) => (
        <span key={moment.key}>
          <span aria-hidden="true" className="px-1.5 text-text-faint">
            ·
          </span>
          {moment.label} <strong className="font-semibold text-text">{moment.value}</strong>
          <span className="text-text-faint">({moment.note})</span>
        </span>
      ))}
    </p>
  );
}
