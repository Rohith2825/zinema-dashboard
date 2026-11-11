"use client";

import { useRef } from "react";
import { RolePicker, type PickerPage, type PickerPerson } from "@/components/role-picker";

/** "Give access" / "Change" on a person's card: opens their access settings in a dialog. */
export function AccessDialog({ person, pages, canMakeAdmins, primary }: { person: PickerPerson; pages: PickerPage[]; canMakeAdmins: boolean; primary?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className={primary ? "btn !py-1.5" : "btn-ghost !py-1.5 text-xs"}>
        {primary ? "Give access" : "Change access"}
      </button>
      <dialog
        ref={ref}
        onClick={(e) => e.target === ref.current && ref.current?.close()}
        className="stage-dialog m-auto w-[min(520px,calc(100vw-1.5rem))] rounded-[28px] bg-surface p-0 text-foreground shadow-[0_40px_100px_-20px_rgba(0,0,0,0.55)] backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex max-h-[88vh] flex-col">
          <header className="flex items-center justify-between px-6 pb-2 pt-6">
            <h2 className="text-lg font-semibold">Access for {person.name}</h2>
            <button type="button" onClick={() => ref.current?.close()} className="btn-ghost !px-3 !py-1.5" aria-label="Close">✕</button>
          </header>
          <div className="overflow-y-auto px-6 pb-6 pt-3">
            <RolePicker people={[person]} pages={pages} defaultPerson={person.id} canMakeAdmins={canMakeAdmins} fixed />
          </div>
        </div>
      </dialog>
    </>
  );
}
