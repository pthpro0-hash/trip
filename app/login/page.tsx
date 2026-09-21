import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginButtons } from "@/components/auth/LoginButtons";
import { getEnabledProviders } from "@/lib/auth/enabledProviders";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "로그인",
  description: "여행 기록을 남기고 어느 기기에서나 이어 보세요.",
  robots: { index: false, follow: false },
};

const REASON: Record<string, string> = {
  cancelled: "로그인을 취소하셨어요.",
  missing_code: "로그인 정보가 오지 않았어요. 다시 시도해 주세요.",
  exchange_failed: "로그인을 마치지 못했어요. 다시 시도해 주세요.",
  not_configured: "지금은 로그인을 쓸 수 없어요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect("/");

  // 코드가 아니라 Supabase 설정이 어떤 수단을 쓸 수 있는지 정한다.
  const providers = await getEnabledProviders();

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-5 pb-16 pt-10">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>

      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">
          여행 기록을 남기려면
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-text-muted">
          로그인하면 담아두신 곳이 계정에 저장되어, 폰에서 담고 컴퓨터에서 이어 볼 수 있어요.
          <br />
          <span className="text-text-faint">
            둘러보기와 검색은 로그인 없이도 그대로 쓰실 수 있어요.
          </span>
        </p>
      </div>

      {error && REASON[error] && (
        <p className="rounded-xl bg-bg-subtle px-4 py-3 text-[14px] text-text-muted">
          {REASON[error]}
        </p>
      )}

      <LoginButtons providers={providers} next={next ?? "/"} />

      {/*
        이용약관과 개인정보처리방침은 아직 준비 중이다. 없는 페이지로 링크를
        걸어 두면 깨진 링크가 되므로, 문서가 올라간 뒤에 링크로 바꾼다.
        실제 서비스를 열기 전에는 반드시 있어야 하는 문서다.
      */}
      <p className="text-[12px] leading-relaxed text-text-faint">
        이용약관과 개인정보처리방침은 준비 중입니다.
      </p>
    </main>
  );
}
