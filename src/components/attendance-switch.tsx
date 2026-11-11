"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleAttendanceRequired } from "@/app/actions";

/** Flips at once, shows it is saving, and flips back with a message if the save fails. */
export function AttendanceSwitch({ userId, name, on }: { userId: string; name: string; on: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(on);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex items-center gap-2">
        {pending && <span className="eq-loader" role="status" aria-label="Saving"><i /><i /><i /><i /></span>}
        <button
          type="button"
          role="switch"
          aria-checked={optimistic}
          aria-label={`Attendance required for ${name}`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setOptimistic(!optimistic);
              const res = await toggleAttendanceRequired(userId, !optimistic);
              if (res?.error) setError(res.error);
            })
          }
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-wait ${optimistic ? "bg-brand-500 shadow-[0_6px_14px_-6px_rgba(252,124,15,0.9)]" : "bg-background shadow-inset-sm"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${optimistic ? "left-6" : "left-1"}`} />
        </button>
      </span>
      {error && <span className="max-w-44 text-right text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
