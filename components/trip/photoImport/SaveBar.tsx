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
  "sticky bottom-0 z-10 -mx-5 -mb-16 mt-2 rounded-t-[28px] bg-bg/90 px-5 py-3 shadow-[0_-10px_30px_-14px_rgba(20,40,80,0.3)] ring-1 ring-line backdrop-blur-xl [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:mx-0 sm:mb-0 sm:rounded-2xl sm:border sm:shadow-lg";

const BUTTON =
  "rounded-full bg-accent px-6 py-3.5 text-[15px] font-semibold text-on-accent transition hover:bg-accent-hover disabled:opacity-60";

/** 로그인하고 이 화면(사진으로 여행 추가)으로 돌아오는 주소. */
export const LOGIN_HREF = `/login?next=${encodeURIComponent(ADD_HREF)}`;

interface SaveBarProps {
  /** save: 기록할 수 있다. login: 로그인해야 기록할 수 있다. */
  mode: "save" | "login";
  /** 실제로 새로 기록될 여행 수(이미 기록한 날짜는 뺀다). */
  count: number;
  /** 이미 기록한 여행에 사진을 더할 여행 수. */
  adding?: number;
  saving: boolean;
  withPhotos: boolean;
  onWithPhotos: (next: boolean) => void;
  onSave: () => void;
  /**
   * 로그인하러 떠나기 전에 부르는 쪽이 사진을 맡아 둘 수 있을 때만 준다. 주면 링크가 곧바로 떠나지 않고 이것을 먼저 부른다
   * (부르는 쪽이 사진을 준비한 뒤 로그인으로 보낸다). 안 주면 예전 길 — 찾은 결과가 로그인을 거치며 사라진다.
   */
  onLogin?: () => void;
  /** 로그인하기 전에 알릴 말 — 사진을 맡아 두려다 못 했을 때. 단추 바로 위에 붙어, 단추를 보는 눈에 함께 들어온다. */
  notice?: string;
  /**
   * 고른 사진이 보관 한도의 남은 자리보다 많을 때(lib/grade). 주면 기록 단추를 막고, 올릴 수 있는 최대 장수를 알려 다시 고르게 한다.
   * 사진 없이 기록하는 것은 막지 않는다 — '사진도 함께 올리기'를 끄면 이 값이 오지 않는다.
   */
  over?: { left: number; picked: number; limit: number };
  /** 사진을 다시 고르는 창을 연다. */
  onRepick?: () => void;
}

export function SaveBar({ mode, count, adding = 0, saving, withPhotos, onWithPhotos, onSave, onLogin, notice, over, onRepick }: SaveBarProps) {
  if (mode === "login") {
    return (
      <div className={ROOT}>
        {notice && (
          <p role="status" className="mb-2 break-keep text-center text-[13px] leading-snug text-text-muted">
            {notice}
          </p>
        )}
        <Link
          href={LOGIN_HREF}
          onClick={
            onLogin
              ? (event) => {
                  event.preventDefault();
                  onLogin();
                }
              : undefined
          }
          className={`${BUTTON} flex w-full items-center justify-center`}
        >
          로그인하고 기록하기
        </Link>
        {/*
          사진을 맡아 둘 수 있으면 그대로 이어진다고 말한다. 맡아 둘 수 없을 때(사생활 보호 모드 · 공간 부족)는 찾은 결과가
          로그인을 거치며 사라진다 — 모르고 로그인했다가 허탈하지 않게 미리 말한다.
        */}
        <p className="mt-1.5 break-keep text-center text-[12px] text-text-faint">
          {onLogin ? "로그인한 뒤 이 여행들을 그대로 이어서 기록해요" : "로그인한 뒤 같은 사진을 한 번 더 골라 주세요"}
        </p>
      </div>
    );
  }

  // 이미 저장한 날짜는 건너뛴다. 단추에도 실제로 기록될 건수를 적어야 눌렀는데 아무것도 안 늘어나는 일이 없다.
  const label = saving
    ? "기록하는 중…"
    : count + adding === 0
      ? "모두 이미 기록했어요"
      : count === 0
        ? "기존 여행에 사진 더하기"
        : `여행 ${count + adding}건 기록하기`;

  return (
    <div className={ROOT}>
      {over && (
        <div role="alert" className="mb-3 flex flex-col gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-text">
          {over.left === 0 ? (
            <p className="break-keep">
              사진 보관 자리가 다 찼어요(보관 한도 {over.limit.toLocaleString("ko-KR")}장). 사진 없이 기록하거나, 내 정보에서 등업을
              신청해 주세요.
            </p>
          ) : (
            <p className="break-keep">
              지금 올릴 수 있는 사진은 <strong>최대 {over.left.toLocaleString("ko-KR")}장</strong>이에요. 고른 사진은{" "}
              {over.picked.toLocaleString("ko-KR")}장이에요. {over.left.toLocaleString("ko-KR")}장 이하로 다시 골라 주세요.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {over.left > 0 && onRepick && (
              <button type="button" onClick={onRepick} className="font-semibold text-accent underline underline-offset-2">
                사진 다시 고르기
              </button>
            )}
            <Link href="/me" className="font-medium text-text-muted underline underline-offset-2">
              보관 한도 · 등업 신청
            </Link>
          </div>
        </div>
      )}
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
        <button type="button" onClick={onSave} disabled={saving || count + adding === 0 || !!over} className={`${BUTTON} shrink-0`}>
          {label}
        </button>
      </div>
    </div>
  );
}
