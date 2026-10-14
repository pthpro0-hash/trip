import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSessionCookieHere } from "@/lib/sessionCookie";

/*
  로그인 확인을 아끼는 두 가지.

  1) 클라이언트를 필요할 때 불러온다. 로그인 연결 코드(약 250KB)가 모든 화면의 첫 JS 에 들어 있어, 로그인하지 않은 사람도
     그것을 받았다. 위 띠·알림 종·찜 동기화처럼 모든 화면에 있는 것들은 loadClient/clientIfSignedIn 으로 불러 쓴다.
     로그인 세션 쿠키가 없으면(둘러보는 사람) 아예 불러오지 않는다 — 어차피 확인할 것이 없다.
  2) 로그인 확인(getUser)은 서버에 묻는 일이라 한 번에 0.1~0.2초가 든다. 한 화면의 여러 부분이 같은 순간에 각자 물으면
     왕복이 그만큼 겹치므로, 같은 클라이언트가 이미 묻고 있는 동안에는 그 답을 같이 쓴다(currentUser).
*/

/** 클라이언트를 불러온다. 키가 없으면 null. */
export async function loadClient(): Promise<SupabaseClient | null> {
  const { getBrowserClient } = await import("./client");
  return getBrowserClient();
}

/** 로그인했을 수 있을 때만 클라이언트를 불러온다. 세션 쿠키가 없으면 null — 둘러보는 사람은 불러올 것이 없다. */
export async function clientIfSignedIn(): Promise<SupabaseClient | null> {
  if (!hasSessionCookieHere()) return null;
  return loadClient();
}

type UserAnswer = ReturnType<SupabaseClient["auth"]["getUser"]>;

const asking = new WeakMap<object, UserAnswer>();

/**
 * supabase.auth.getUser() 와 같은 답을 준다. 같은 클라이언트가 이미 묻는 중이면 그 답을 같이 받는다(답이 오면 잊는다 —
 * 오래 들고 있지 않으니 로그아웃·계정 바뀜을 놓치지 않는다).
 */
export function currentUser(supabase: SupabaseClient): UserAnswer {
  const pending = asking.get(supabase);
  if (pending) return pending;
  const answer = Promise.resolve(supabase.auth.getUser()) as UserAnswer;
  asking.set(supabase, answer);
  const forget = () => {
    if (asking.get(supabase) === answer) asking.delete(supabase);
  };
  answer.then(forget, forget);
  return answer;
}
