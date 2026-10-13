import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageName } from "@/lib/usage";

/*
  서비스에 무슨 일이 있었는지 남긴다.

  로그인한 사람의 일만 남긴다 — 개인정보처리방침이 "로그인하지 않고 둘러보실 때는 아무것도 모으지
  않습니다"라고 약속한다.

  남기는 것은 세어 본 수와 결과뿐이다. 좌표도, 장소 이름도, 사진 파일명도,
  검색어도 보내지 않는다 — 이 서비스가 다루는 것이 "언제 어디에 누구와
  있었는지" 라서, 그것을 기록에 옮겨 적으면 기록 자체가 위험해진다.
  무엇이 고장 났는지 알아내는 데는 수와 결과로 충분하다.

  한 달이 지나면 지워진다(supabase/log.sql 참고).
*/

/** 남기는 일들. 새 이름을 늘릴 때는 아래 표와 개인정보처리방침을 함께 본다. */
export type ServiceEvent =
  | "signed_in"
  | "photos_read"
  | "trips_saved"
  | "photos_uploaded"
  | "trip_reshaped"
  | "trip_renamed"
  | "trip_deleted"
  | "photo_deleted"
  /** 어떤 화면을 열고 어떤 기능을 썼는지(lib/usage). 이름만 남긴다. */
  | `use.${UsageName}`;

/** 수와 참·거짓만 싣는다. 자유롭게 쓴 글은 싣지 않는다. */
export type LogDetail = Record<string, number | boolean>;

/**
 * 한 줄 남긴다. 절대 던지지 않고, 기다리게 하지도 않는다.
 *
 * 기록하려다 본래 하던 일이 멈추면 주객이 전도된다. 로그인하지 않았으면 남기지 않는다
 * (예전에는 누구인지 없이 남겼는데, 방침의 약속과 어긋났다).
 */
export function logEvent(
  supabase: SupabaseClient | null,
  event: ServiceEvent,
  detail: LogDetail = {},
): void {
  if (!supabase) return;
  try {
    /*
      두 겹으로 막는다. 부르는 것 자체가 던질 수 있고(표를 아직 만들지
      않았거나 client 모양이 다를 때), 부른 뒤에 실패할 수도 있다.
      어느 쪽이든 하던 일은 그대로 이어져야 한다.
    */
    void Promise.resolve(supabase.auth.getSession())
      .then(({ data }) => (data.session ? supabase.rpc("log_event", { p_event: event, p_detail: detail }) : undefined))
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // 남기지 못한 것뿐이다.
  }
}
