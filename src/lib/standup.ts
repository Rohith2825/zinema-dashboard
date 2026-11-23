import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KIND_LABEL, TZ, shortName, stageLabel, type DeliverableKind } from "@/lib/types";

/**
 * The daily stand-up: what is waiting, late or blocked, worked out from the data (no AI).
 * It runs as the signed-in person, so everyone sees only the pages they have access to.
 */

export type StandupItem = { code: string | null; title: string; page: string; text: string; who: string | null; days: number | null };
export type StandupSection = { key: string; label: string; hint: string; items: StandupItem[] };
export type Standup = { date: string; total: number; sections: StandupSection[] };

type Version = { version: number; status: string; submitted_at: string; submitted_by: string };
type SongRef = { id: string; code: string; title: string; current_stage: string; planned_release_date: string | null; page: { name: string } | null };
type Deliv = { kind: DeliverableKind; slot: number; due_at: string | null; required: boolean; assignee_id: string | null; checker_id: string | null; song: SongRef | null; deliverable_versions: Version[] };

const DAY = 86400000;
const pageName = (n?: string | null) => (n ?? "").replace("Zinema.music ", "").replace("Zinema.music", "Main") || "Main";
const ago = (d: number) => (d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`);

export async function buildStandup(supabase: SupabaseClient, pageFilter?: string): Promise<Standup> {
  const now = Date.now();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now));
  const soon = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now + 14 * DAY));
  const [delivR, tasksR, peopleR, soonR] = await Promise.all([
    supabase.from("deliverables").select("kind, slot, due_at, required, assignee_id, checker_id, song:songs(id, code, title, current_stage, planned_release_date, page:pages(name)), deliverable_versions(version, status, submitted_at, submitted_by)"),
    supabase.from("tasks").select("title, status, due_at, assignee_id, song:songs(code, title), page:pages(name)").neq("status", "done"),
    supabase.from("profiles").select("id, full_name, nickname, email"),
    supabase.from("songs").select("id, code, title, current_stage, planned_release_date, page:pages(name), song_formats(label, status, mandatory)").gte("planned_release_date", today).lte("planned_release_date", soon).neq("current_stage", "live"),
  ]);
  const people = new Map((peopleR.data ?? []).map((p) => [p.id as string, shortName(p)]));
  const who = (id: string | null | undefined) => (id ? people.get(id) ?? null : null);
  const days = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
  const name = (d: Deliv) => `${KIND_LABEL[d.kind] ?? d.kind}${["carousel", "vertical"].includes(d.kind) ? ` ${d.slot}` : ""}`;

  const toCheck: StandupItem[] = [], toFix: StandupItem[] = [], late: StandupItem[] = [];
  const openBySong = new Map<string, string[]>();
  for (const d of (delivR.data ?? []) as unknown as Deliv[]) {
    if (!d.song) continue;
    const base = { code: d.song.code, title: d.song.title, page: pageName(d.song.page?.name) };
    const latest = [...d.deliverable_versions].sort((a, b) => b.version - a.version)[0];
    if (latest?.status === "submitted") {
      const n = days(latest.submitted_at);
      toCheck.push({ ...base, text: `${name(d)} v${latest.version} has waited ${ago(n)} for a check`, who: who(d.checker_id) ?? "no checker set", days: n });
    } else if (latest?.status === "changes_requested") {
      const n = days(latest.submitted_at);
      toFix.push({ ...base, text: `${name(d)} needs a new version (changes were asked for)`, who: who(d.assignee_id) ?? who(latest.submitted_by), days: n });
    }
    if (d.due_at && new Date(d.due_at).getTime() < now && latest?.status !== "approved") {
      const n = days(d.due_at);
      late.push({ ...base, text: `${name(d)} was due ${n === 0 ? "today" : `${ago(n)} ago`}${latest ? "" : " and nothing is submitted"}`, who: who(d.assignee_id) ?? "nobody assigned", days: n });
    }
    if (d.required && latest?.status !== "approved") openBySong.set(d.song.id, [...(openBySong.get(d.song.id) ?? []), name(d)]);
  }

  type Task = { title: string; status: string; due_at: string | null; assignee_id: string | null; song: { code: string; title: string } | null; page: { name: string } | null };
  const tasks: StandupItem[] = [];
  for (const t of (tasksR.data ?? []) as unknown as Task[]) {
    const overdue = t.due_at && new Date(t.due_at).getTime() < now;
    if (!overdue && t.status !== "blocked") continue;
    const n = t.due_at && overdue ? days(t.due_at) : null;
    tasks.push({ code: t.song?.code ?? null, title: t.song?.title ?? "General", page: pageName(t.page?.name), text: `Task "${t.title}" is ${t.status === "blocked" ? "blocked" : ""}${t.status === "blocked" && overdue ? " and " : ""}${overdue ? (n === 0 ? "due today" : `${ago(n!)} late`) : ""}`, who: who(t.assignee_id) ?? "nobody assigned", days: n });
  }

  type Soon = SongRef & { song_formats: { label: string; status: string; mandatory: boolean }[] };
  const releases: StandupItem[] = [];
  for (const s of (soonR.data ?? []) as unknown as Soon[]) {
    if (!s.planned_release_date) continue;
    const left = Math.round((new Date(`${s.planned_release_date}T00:00:00+05:30`).getTime() - new Date(`${today}T00:00:00+05:30`).getTime()) / DAY);
    const files = openBySong.get(s.id) ?? [];
    const formats = s.song_formats.filter((f) => f.mandatory && !["approved", "live"].includes(f.status)).map((f) => f.label);
    const missing = [...files, ...formats];
    releases.push({
      code: s.code, title: s.title, page: pageName(s.page?.name), who: null, days: left,
      text: `Releases ${left === 0 ? "today" : `in ${ago(left)}`}, now at ${stageLabel(s.current_stage)}. ${missing.length ? `Not ready yet: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? ` and ${missing.length - 6} more` : ""}` : "Everything required is approved"}`,
    });
  }

  const pick = (xs: StandupItem[], asc = false) => xs.filter((x) => !pageFilter || x.page.toLowerCase() === pageFilter.toLowerCase()).sort((a, b) => (asc ? 1 : -1) * ((a.days ?? 0) - (b.days ?? 0)));
  const sections: StandupSection[] = [
    { key: "releases", label: "Releasing in the next 14 days", hint: "What still has to be approved before release day.", items: pick(releases, true) },
    { key: "check", label: "Waiting for a check", hint: "Oldest first. A file isn't done until someone else checks it.", items: pick(toCheck) },
    { key: "fix", label: "Waiting for a new version", hint: "Changes were asked for and nothing new has come in.", items: pick(toFix) },
    { key: "late", label: "Past the due date", hint: "Files that were due and aren't approved.", items: pick(late) },
    { key: "tasks", label: "Tasks late or blocked", hint: "", items: pick(tasks) },
  ];
  return { date: today, total: sections.reduce((n, s) => n + s.items.length, 0), sections };
}
