import type { TripPostcardLine } from "@/lib/supabase/postcards";

/*
  보낸 엽서는 열어 보셨을까.

  엽서를 보내고 나면 궁금한 것은 하나다 — 부모님이 열어 보셨나. 예전에는 ‘내 정보 → 가족 책장’의 보낸 엽서 목록을 열어야 알 수
  있었다. 여행 상세의 공유 줄 아래에 받는 곳마다 한 줄로 알려 준다. 보내지 않은 여행에는 아무것도 그리지 않는다.
  답장과 하트는 여기서 보여 주지 않는다(가족 책장에서 본다).
*/

interface TripPostcardStatusProps {
  lines: TripPostcardLine[];
}

export function TripPostcardStatus({ lines }: TripPostcardStatusProps) {
  if (lines.length === 0) return null;

  return (
    <ul aria-label="보낸 엽서" className="flex w-full flex-col gap-0.5 text-[14px] text-text-muted">
      {lines.map((line) => (
        <li key={line.mailboxId} className="break-keep">
          {line.greetingName ? `${line.greetingName}께 엽서를 보냈어요` : `${line.name}에 엽서를 보냈어요`}
          {" · "}
          {line.opened ? (
            <span className="font-medium text-accent">
              열어 보셨어요 <span aria-hidden="true">✓</span>
            </span>
          ) : (
            "아직 안 열어 보셨어요"
          )}
        </li>
      ))}
    </ul>
  );
}
