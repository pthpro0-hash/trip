import Link from "next/link";
import { ADD_HREF } from "@/lib/nav";

/*
  기록하는 단추 — 화면 아래에 붙는 막대.

  단추가 길게 늘어선 카드 목록의 맨 끝에 있으면 카드가 열 장일 때 한참 내려가야 하고, 사람은 "이제 뭘
  눌러야 하지?"를 찾는다. 아래에 붙여 두면 어디를 보고 있든 다음 걸음이 보인다. 한장 요약의 저장 막대와
  같은 방식이다(sticky): 목록이 끝나면 그 자리에 얹히고, 기기 아래 막대(홈 바)는 피한다.

  이 화면에서는 폰 하단 탭을 접는다(lib/nav showsBottomNav) — 막대와 탭이 같은 자리에 쌓이면 화면 아래
  6분의 1이 단추로 덮인다.
*/

/*
  -mb-16: 화면(app/trips/new/page)의 아래 여백(pb-16)만큼 막대를 끌어내린다. 그렇지 않으면 목록 끝에서 막대가
  화면 맨 아래에 붙지 않고 여백만큼 떠 있다. 넓은 화면(sm~)에서는 떠 있는 카드라 여백을 그대로 둔다.
*/
const ROOT =
  "sticky bottom-0 z-10 -mx-5 -mb-16 mt-2 border-t border-line bg-bg/95 px-5 py-3 backdrop-blur-md [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:mx-0 sm:mb-0 sm:rounded-2xl sm:border sm:shadow-lg";

const BUTTON =
  "rounded-full bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60";

interface SaveBarProps {
  /** save: 기록할 수 있다. login: 로그인해야 기록할 수 있다. */
  mode: "save" | "login";
  /** 실제로 새로 기록될 여행 수(이미 기록한 날짜는 뺀다). */
  count: number;
  saving: boolean;
  withPhotos: boolean;
  onWithPhotos: (next: boolean) => void;
  onSave: () => void;
}

export function SaveBar({ mode, count, saving, withPhotos, onWithPhotos, onSave }: SaveBarProps) {
  if (mode === "login") {
    return (
      <div className={ROOT}>
        <Link
          href={`/login?next=${encodeURIComponent(ADD_HREF)}`}
          className={`${BUTTON} flex w-full items-center justify-center`}
        >
          로그인하고 기록하기
        </Link>
        {/* 찾은 결과는 로그인을 거치며 사라진다. 모르고 로그인했다가 허탈하지 않게 미리 말한다. */}
        <p className="mt-1.5 break-keep text-center text-[12px] text-text-faint">로그인한 뒤 같은 사진을 한 번 더 골라 주세요</p>
      </div>
    );
  }

  // 이미 저장한 날짜는 건너뛴다. 단추에도 실제로 기록될 건수를 적어야 눌렀는데 아무것도 안 늘어나는 일이 없다.
  const label = saving ? "기록하는 중…" : count === 0 ? "모두 이미 기록했어요" : `여행 ${count}건 기록하기`;

  return (
    <div className={ROOT}>
      <div className="flex items-center gap-3">
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={withPhotos}
            onChange={(event) => onWithPhotos(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="min-w-0 leading-snug">
            <span className="block text-[14px] font-medium text-text">사진도 함께 올리기</span>
            <span className="block break-keep text-[12px] text-text-faint [text-wrap:balance]">줄여서 올리고 원본은 보관하지 않아요</span>
          </span>
        </label>
        <button type="button" onClick={onSave} disabled={saving || count === 0} className={`${BUTTON} shrink-0`}>
          {label}
        </button>
      </div>
    </div>
  );
}
