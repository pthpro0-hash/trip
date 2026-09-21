import Link from "next/link";

/*
  약관·방침처럼 길고 딱딱한 글을 읽을 만하게 두는 껍데기.
  본문 폭을 좁게 잡아 한 줄이 너무 길어지지 않게 한다.
*/
export function LegalDocument({
  title,
  effectiveDate,
  children,
}: {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-5 pb-20 pt-8">
      <Link href="/" className="text-[15px] font-medium text-accent hover:text-accent-hover">
        ← 목록으로
      </Link>
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text md:text-[32px]">{title}</h1>
        <p className="mt-1 text-[13px] text-text-faint">시행일 {effectiveDate}</p>
      </div>
      <div className="flex flex-col gap-7">{children}</div>
    </main>
  );
}

export function Article({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[17px] font-semibold tracking-tight text-text">{heading}</h2>
      <div className="flex flex-col gap-2 text-[15px] leading-[1.75] text-text-muted">
        {children}
      </div>
    </section>
  );
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** 사업자가 직접 채워야 하는 자리. 지우지 말고 눈에 띄게 남겨 둔다. */
export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-[#fff3bf] px-1.5 py-0.5 font-medium text-[#664d03]">
      【{children}】
    </mark>
  );
}
