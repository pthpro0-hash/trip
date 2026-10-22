import type { SupabaseClient } from "@supabase/supabase-js";
import { hasSessionCookieHere } from "@/lib/sessionCookie";

/*
  로그인 확인을 아끼는 두 가지.

  1) 클라이언트를 필요할 때 불러온다. 로그인 연결 코드(약 250KB)가 모든 화면의 첫 JS 에 들어 있어, 로그인하지 않은 사람도
     그것을 받았다. 위 띠·알림 종·찜 동기화처럼 모든 화면에 있는 것들은 loadClient/clientIfSignedIn 으로 불러 쓴다.
     로그인 세션 쿠키가 없으면(둘러보는 사람) 아예 불러오지 않는다 — 어차피 확인할 것이 없다.
  2) 누가 로그인했는지는 브라우저가 이미 들고 있는 세션(getSession)에서 읽는다. 예전에는 화면마다 서버에 물었다(getUser) —
     Supabase 가 멀어 한 번에 0.2~0.4초가 들었고, 그 답을 받은 뒤에야 자료를 읽기 시작해 모든 화면이 그만큼 늦게 떴다.
     브라우저에서는 이것으로 충분하다: 이 id 로 무엇을 읽고 쓸 수 있는지는 DB 의 정책이 토큰으로 다시 확인하고, 세션이 끝났으면
     getSession 이 토큰을 새로 받거나 빈 답을 준다. 서버 쪽 확인(proxy.ts · lib/supabase/server)은 그대로 getUser 다.
     한 화면의 여러 부분이 같은 순간에 물으면 같은 답을 같이 쓴다(currentUser).
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

/** 브라우저가 들고 있는 세션에서 사용자를 꺼낸다. getUser 와 같은 모양({ data: { user } })으로 돌려준다. */
async function sessionUser(supabase: SupabaseClient): Promise<Awaited<UserAnswer>> {
  const { data, error } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  return (user ? { data: { user }, error: null } : { data: { user: null }, error }) as Awaited<UserAnswer>;
}

/**
 * 지금 로그인한 사람. supabase.auth.getUser() 와 같은 모양의 답을 주되 서버에 묻지 않고 세션에서 읽는다(위 2). 같은 클라이언트가
 * 이미 묻는 중이면 그 답을 같이 받는다(답이 오면 잊는다 — 오래 들고 있지 않으니 로그아웃·계정 바뀜을 놓치지 않는다).
 * 세션을 읽을 수 없는 클라이언트(getSession 이 없다)면 예전처럼 서버에 묻는다.
 */
export function currentUser(supabase: SupabaseClient): UserAnswer {
  const pending = asking.get(supabase);
  if (pending) return pending;
  const answer = Promise.resolve(
    typeof supabase.auth.getSession === "function" ? sessionUser(supabase) : supabase.auth.getUser(),
  ) as UserAnswer;
  asking.set(supabase, answer);
  const forget = () => {
    if (asking.get(supabase) === answer) asking.delete(supabase);
  };
  answer.then(forget, forget);
  return answer;
}
