import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * 서버 렌더와 라우트 핸들러에서 쓰는 클라이언트.
 *
 * 요청마다 새로 만든다 — 하나를 여러 요청이 나눠 쓰면 남의 세션이 섞인다.
 * 키가 없으면 null을 돌려주고, 부르는 쪽은 로그인 기능만 끈다.
 */
export async function createClient() {
  if (!isSupabaseConfigured) return null;

  // Next.js 16에서 cookies()는 비동기다.
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy.ts가
          // 맡고 있으므로 여기서는 그냥 넘어가도 된다.
        }
      },
    },
  });
}

/** 지금 로그인한 사람. 로그인 전이거나 키가 없으면 null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch {
    // Supabase가 응답하지 않아도 로그인 전 화면으로 보여줄 뿐, 페이지는 뜬다.
    return null;
  }
}
