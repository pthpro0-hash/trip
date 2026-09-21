/*
  로그인은 있으면 좋은 것이지, 없다고 앱이 멈출 것은 아니다.
  둘러보기·검색·권역은 로그인 없이 그대로 되어야 하므로, 키가 없으면
  조용히 로그인 기능만 꺼진다.
*/
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
