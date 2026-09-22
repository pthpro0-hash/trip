import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/*
  카카오에서 돌아오는 자리. 받은 코드를 세션으로 바꾼다.

  돌아갈 주소는 우리가 보낸 `next` 값만 받아들이되, 반드시 "/"로 시작하는
  우리 경로여야 한다. 그러지 않으면 남이 만든 링크로 외부 사이트에
  실어 보낼 수 있다.
*/
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // 카카오 동의 화면에서 취소하면 코드 대신 error가 온다.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(`${origin}/login?error=cancelled`);
  }

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  if (!supabase) return NextResponse.redirect(`${origin}/login?error=not_configured`);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=exchange_failed`);

  /*
    들어온 것을 남긴다. 어느 제공자로 들어왔는지는 남기지 않는다 —
    무엇이 고장 났는지 아는 데 필요한 것은 "들어와졌다" 뿐이고,
    제공자별 수는 Supabase 대시보드가 이미 들고 있다.
  */
  try {
    await supabase.rpc("log_event", { p_event: "signed_in", p_detail: {} });
  } catch {
    // 기록하려다 로그인이 막히면 안 된다.
  }

  return NextResponse.redirect(`${origin}${next}`);
}
