import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/*
  로그인 세션을 이어 주는 자리.

  Next.js 16에서 middleware.js는 폐기되고 proxy.js로 이름이 바뀌었다.
  Supabase 안내문은 아직 middleware.ts를 만들라고 하는데, 이 버전에서
  그렇게 하면 아무것도 실행되지 않고 세션이 조용히 끊긴다.

  토큰은 수명이 짧아 계속 갱신해야 하고, 갱신된 토큰은 쿠키로 돌려줘야 한다.
  그래서 응답을 만들기 전에 getUser()를 먼저 부른다 — 응답이 나간 뒤에
  갱신이 끝나면 새 토큰을 쓸 곳이 없어진다.
*/
export async function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // 키가 잘못됐거나 Supabase가 응답하지 않아도 페이지는 떠야 한다.
    // 로그인만 안 될 뿐, 둘러보기와 검색은 그대로 된다.
  }

  return response;
}

export const config = {
  /*
    matcher가 없으면 정적 파일과 이미지에까지 돈다. 로그인 검사가 CSS와
    이미지를 막는 사고가 여기서 난다.
  */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
