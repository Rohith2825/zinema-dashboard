import { Suspense } from "react";
import { TasksSkeleton } from "@/components/skeletons";
import Link from "next/link";
import { createTask } from "@/app/actions";
import { ActionForm, Submit } from "@/components/action-form";
import { TaskBoard, type TaskCard } from "@/components/task-board";
import { PageTabs, PageTitle, pageShort } from "@/components/ui";
import { getSession, pageBySlug } from "@/lib/session";
import { fmtDate, shortName, type Profile, type TaskStatus } from "@/lib/types";

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <Suspense fallback={<TasksSkeleton />}>
      <Tasks searchParams={searchParams} />
    </Suspense>
  );
}

async function Tasks({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const page = pageBySlug(s.pages, sp.page);
  const mine = sp.mine === "1";

  let q = s.supabase
    .from("tasks")
    .select("id, title, status, assignee_id, due_at, page_id, song:songs(code)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (page) q = q.eq("page_id", page.id);
  if (mine) q = q.eq("assignee_id", s.user.id);
  const [{ data }, { data: peopleData }, { data: songsData }] = await Promise.all([
    q,
    s.supabase.from("profiles").select("id, full_name, email, is_org_admin").order("full_name"),
    s.supabase.from("songs").select("id, code, title, page_id").neq("current_stage", "live").order("code"),
  ]);
  const people = (peopleData ?? []) as Profile[];

  const tasks: TaskCard[] = (data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status as TaskStatus,
    assignee: t.assignee_id ? shortName(people.find((p) => p.id === t.assignee_id)) : null,
    due: t.due_at ? fmtDate(t.due_at, { day: "numeric", month: "short" }) : null,
    overdue: isOverdue(t.due_at, t.status),
    songCode: (t.song as unknown as { code: string } | null)?.code ?? null,
    page: pageShort(s.pages.find((p) => p.id === t.page_id)?.name),
  }));
  const workPages = s.pages.filter((p) => s.canWork(p.id));

  return (
    <>
      <PageTitle
        title="Tasks"
        sub="Drag cards between columns."
        actions={
          <Link href={`/tasks?${new URLSearchParams({ ...(page ? { page: page.slug } : {}), ...(mine ? {} : { mine: "1" }) })}`} className="btn-ghost">
            {mine ? "Everyone's tasks" : "Only mine"}
          </Link>
        }
      />
      <PageTabs pages={s.pages} current={page?.slug} base="/tasks" extra={{ mine: mine ? "1" : undefined }} />

      {workPages.length > 0 && (
        <ActionForm action={createTask} resetOnSuccess className="card mb-4 grid gap-2 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <input name="title" required placeholder="New task…" className="input" />
          <select name="page_id" required className="input" defaultValue={page?.id ?? workPages[0].id}>
            {workPages.map((p) => <option key={p.id} value={p.id}>{pageShort(p.name)}</option>)}
          </select>
          <select name="song_id" className="input" defaultValue="">
            <option value="">No song</option>
            {(songsData ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.title}</option>)}
          </select>
          <select name="assignee_id" className="input" defaultValue="">
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{shortName(p)}</option>)}
          </select>
          <input name="due_at" type="date" className="input" />
          <Submit>Add</Submit>
        </ActionForm>
      )}

      <TaskBoard tasks={tasks} />
    </>
  );
}

function isOverdue(due: string | null, status: string) {
  return Boolean(due && status !== "done" && new Date(due).getTime() < Date.now());
}
