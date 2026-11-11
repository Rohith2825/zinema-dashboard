"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { setTaskStatus } from "@/app/actions";
import { TASK_COLUMNS, type TaskStatus } from "@/lib/types";

export type TaskCard = {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: string | null;
  due: string | null;
  overdue: boolean;
  songCode: string | null;
  page: string;
};

/** Drag a card between columns to change its status. */
export function TaskBoard({ tasks }: { tasks: TaskCard[] }) {
  const [optimistic, move] = useOptimistic(tasks, (state, { id, status }: { id: string; status: TaskStatus }) =>
    state.map((t) => (t.id === id ? { ...t, status } : t)),
  );
  const [, start] = useTransition();

  const drop = (status: TaskStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task");
    if (!id) return;
    start(async () => {
      move({ id, status });
      await setTaskStatus(id, status);
    });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
      <div className="grid min-w-[880px] grid-cols-4 gap-3">
        {TASK_COLUMNS.map((col) => {
          const items = optimistic.filter((t) => t.status === col.key);
          return (
            <section
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={drop(col.key)}
              className="well min-h-64 p-3"
            >
              <header className="mb-2 flex justify-between px-1 text-sm">
                <h2 className="font-semibold text-zinc-700">{col.label}</h2>
                <span className="text-xs text-muted">{items.length}</span>
              </header>
              <div className="space-y-3">
                {items.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task", t.id)}
                    className="tile tile-hover cursor-grab p-3.5 text-sm active:cursor-grabbing"
                  >
                    <p className={`font-medium ${t.status === "done" ? "text-zinc-400 line-through" : ""}`}>{t.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-2 text-xs text-muted">
                      <span>{t.assignee ?? "Unassigned"}</span>
                      {t.due && <span className={t.overdue ? "font-medium text-red-600" : ""}>due {t.due}</span>}
                      {t.songCode && <Link href={`/songs/${t.songCode}`} className="text-brand-700">{t.songCode}</Link>}
                      <span>{t.page}</span>
                    </div>
                    {/* Fallback for touch screens: move with a select */}
                    <select
                      aria-label="Move task"
                      value={t.status}
                      onChange={(e) => {
                        const status = e.target.value as TaskStatus;
                        start(async () => {
                          move({ id: t.id, status });
                          await setTaskStatus(t.id, status);
                        });
                      }}
                      className="input mt-2 !py-1 text-xs md:hidden"
                    >
                      {TASK_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
