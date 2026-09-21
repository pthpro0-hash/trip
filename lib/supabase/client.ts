"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

let cached: SupabaseClient | null = null;

/** 브라우저에서 쓰는 클라이언트. 키가 없으면 null. */
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  // 브라우저에서는 한 벌만 있으면 된다 — 매번 만들면 세션 구독이 쌓인다.
  cached ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}
