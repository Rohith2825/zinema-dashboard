import { Suspense } from "react";
import Link from "next/link";
import { saveAuditRules } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { ListSkeleton } from "@/components/skeletons";
import { Badge, Empty, PageTitle, pageShort } from "@/components/ui";
import { RULE_GROUPS, type RuleField } from "@/lib/audit/rules-spec";
import { getSession, pageBySlug } from "@/lib/session";

export const metadata = { title: "Audit rules" };

export default function AuditRulesPage({ searchParams }: PageProps<"/audit-rules">) {
  return (
    <Suspense fallback={<ListSkeleton label="Loading audit rules" />}>
      <AuditRules searchParams={searchParams} />
    </Suspense>
  );
}

function Field({ f, value, canEdit }: { f: RuleField; value: unknown; canEdit: boolean }) {
  const input = (name: string, v: unknown, label: string) =>
    f.options ? (
      <select name={name} defaultValue={String(v)} disabled={!canEdit} aria-label={label} className="input w-28">
        {f.options.map((o) => <option key={o} value={o}>{o.toLocaleString("en-IN")}</option>)}
      </select>
    ) : (
      <input name={name} type="number" inputMode="decimal" required step={f.step ?? 1} min={f.min} max={f.max} defaultValue={String(v ?? "")} disabled={!canEdit} aria-label={label} className="input w-24 tabular-nums" />
    );
  const pair = Array.isArray(value) ? value : [value, value];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="text-sm font-medium">{f.label}</p>
        {f.hint && <p className="text-xs text-muted">{f.hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {f.pair ? (
          <>
            <span>{f.pair[0]}</span>{input(`${f.key}.0`, pair[0], `${f.label}: ${f.pair[0]}`)}
            <span>{f.pair[1]}</span>{input(`${f.key}.1`, pair[1], `${f.label}: ${f.pair[1]}`)}
          </>
        ) : input(f.key, value, f.label)}
        {f.unit && <span className="w-14">{f.unit}</span>}
      </div>
    </div>
  );
}

async function AuditRules({ searchParams }: Pick<PageProps<"/audit-rules">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const page = pageBySlug(s.pages, sp.page) ?? s.pages[0];
  const canEdit = s.isAdmin || s.isOwner;
  if (!page) return (<><PageTitle title="Audit rules" /><Empty>You don&apos;t have access to any page yet.</Empty></>);

  const { data } = await s.supabase.from("audit_thresholds").select("kind, rules").eq("page_id", page.id);
  const stored = new Map((data ?? []).map((r) => [r.kind as string, r.rules as Record<string, unknown>]));
  const tab = (active: boolean) => `rounded-full px-3.5 py-1.5 text-sm transition ${active ? "bg-[#0d0d10] font-medium text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.7)]" : "text-zinc-600 hover:text-black"}`;

  return (
    <>
      <PageTitle
        title="Audit rules"
        sub={canEdit ? "The limits each audit checks against. Every page has its own." : "The limits each audit checks against. Only admins and owners can change them."}
      />
      <div className="well mb-6 flex max-w-full gap-1 overflow-x-auto !rounded-full p-1.5 [scrollbar-width:none] sm:inline-flex [&>a]:shrink-0">
        {s.pages.map((p) => <Link key={p.id} href={`/audit-rules?page=${p.slug}`} className={tab(p.id === page.id)}>{pageShort(p.name)}</Link>)}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-2">
        {RULE_GROUPS.map((g) => {
          const rules = { ...g.defaults, ...(stored.get(g.kinds[0]) ?? {}) } as Record<string, unknown>;
          return (
            <section key={`${page.id}-${g.id}`} className={`card p-4 md:p-6 ${g.id === "mix" ? "xl:row-span-4" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{g.title}</h2>
                {!stored.has(g.kinds[0]) && <Badge>standard values</Badge>}
              </div>
              <p className="text-xs text-muted">{g.about} For {pageShort(page.name)} only.</p>
              <ActionForm action={saveAuditRules} className="mt-2">
                <input type="hidden" name="page_id" value={page.id} />
                <input type="hidden" name="group" value={g.id} />
                <div className="hairline divide-y divide-black/[0.06]">
                  {g.fields.map((f) => <Field key={f.key} f={f} value={rules[f.key]} canEdit={canEdit} />)}
                </div>
                {canEdit && <div className="mt-3"><Submit>Save {g.title.toLowerCase()} rules</Submit></div>}
              </ActionForm>
            </section>
          );
        })}
      </div>
    </>
  );
}
