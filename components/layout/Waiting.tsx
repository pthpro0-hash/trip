/*
  기다리게 할 때의 얼굴.

  사진 삼백 장을 고르면 브라우저가 그것을 건네주는 데만 몇 초가 걸린다.
  그 몇 초 동안 화면이 그대로면 사람은 "눌렀는데 안 되네" 하고 다시 누른다.
  그러면 처음부터 다시 시작한다.

  그래서 오래 걸리는 일에는 예외 없이 같은 얼굴을 내민다. 무엇을 하고
  있는지(title), 어디까지 왔는지(detail), 그리고 기다려 달라는 말.
  자리마다 다르게 생기면 매번 새로 읽어야 하니, 생김새는 하나로 둔다.
*/

interface WaitingProps {
  /** 지금 하고 있는 일. "사진을 읽고 있어요" 처럼. */
  title: string;
  /** 어디까지 왔는지. "12장 / 300장" 처럼. 셀 수 없으면 비운다. */
  detail?: string;
  /** 덧붙일 안심. "사진은 아직 어디로도 올라가지 않았어요" 처럼. */
  note?: string;
}

/*
  도는 고리.

  숫자가 있어도 고리는 둔다. 숫자는 한참 멈춰 있을 수 있지만 — 큰 사진
  한 장을 읽는 동안이 그렇다 — 고리가 돌고 있으면 멈춘 게 아님을 안다.
*/
function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
    />
  );
}

function Body({ title, detail, note }: WaitingProps) {
  return (
    <>
      <Spinner />
      <p className="text-[17px] font-medium text-text">{title}</p>
      {detail && <p className="text-[15px] text-text-muted">{detail}</p>}
      <p className="text-[14px] text-text-muted">잠시만 기다려 주세요.</p>
      {note && <p className="text-[13px] leading-relaxed text-text-faint">{note}</p>}
    </>
  );
}

/**
 * 자리를 대신 채우는 안내. 아직 보여줄 것이 없을 때 — 불러오는 중,
 * 읽는 중 — 그 자리에 그대로 놓는다.
 */
export function Waiting(props: WaitingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-2.5 rounded-2xl bg-bg-subtle p-8 text-center"
    >
      <Body {...props} />
    </div>
  );
}

/**
 * 화면을 덮는 안내. 이미 보여줄 것이 있는데 그 위에서 오래 걸리는 일이
 * 도는 경우 — 기록하기, 정리하기, 지우기 — 에 쓴다.
 *
 * 덮는 이유는 알림이 아니라 잠금이다. 올리는 중에 다른 단추를 누르면
 * 같은 사진이 두 번 올라가거나 절반만 올라간 채로 자리를 뜨게 된다.
 */
export function WaitingOverlay(props: WaitingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-6 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-2.5 rounded-2xl bg-surface p-8 text-center shadow-xl ring-1 ring-line">
        <Body {...props} />
      </div>
    </div>
  );
}
