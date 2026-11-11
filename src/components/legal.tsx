import { PublicFooter, PublicHeader } from "@/components/marketing";

export const Mail = () => <a href="mailto:info@zinema.music" className="font-medium text-brand-700 underline">info@zinema.music</a>;

/** Shared layout for the privacy policy and terms. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode; sections: [string, React.ReactNode][] }) {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <PublicHeader />
      <div className="mx-auto mt-14 w-[min(820px,calc(100%-2rem))]">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-6 text-[15px] leading-relaxed text-zinc-700">{intro}</div>
        <div className="mt-10 space-y-6">
          {sections.map(([heading, body], i) => (
            <section key={heading} className="card p-6 md:p-8">
              <h2 className="flex items-center gap-3 text-lg font-semibold">
                <span className="tile flex h-8 w-8 shrink-0 items-center justify-center !rounded-full text-xs">{i + 1}</span>
                {heading}
              </h2>
              <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-zinc-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{body}</div>
            </section>
          ))}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
