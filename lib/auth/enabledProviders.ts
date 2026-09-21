import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";
import { AUTH_PROVIDERS, type AuthProvider } from "./providers";

const TIMEOUT_MS = 4000;
// 로그인 수단을 켜고 끄는 일은 드물다. 매번 물어볼 필요가 없다.
const REVALIDATE_SECONDS = 300;

/**
 * Supabase에 실제로 켜져 있는 로그인 수단만 고른다.
 *
 * 코드에 박아두면 두 방향으로 어긋난다. 켜지 않은 수단의 버튼을 보여주면
 * 눌렀을 때 영문 모를 오류가 나고, 켰는데 버튼이 없으면 설정을 몇 번씩
 * 다시 들여다보게 된다. 실제 상태를 그대로 보여주는 편이 낫다.
 *
 * 물어보지 못하면 아는 수단을 모두 보여준다 — 로그인 화면이 텅 비어
 * 아무것도 못 하게 되는 것보다는 낫다.
 */
export async function getEnabledProviders(): Promise<AuthProvider[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return AUTH_PROVIDERS;

    const settings: { external?: Record<string, boolean> } = await response.json();
    const external = settings.external;
    if (!external) return AUTH_PROVIDERS;

    return AUTH_PROVIDERS.filter((provider) => external[provider.id]);
  } catch {
    return AUTH_PROVIDERS;
  }
}
