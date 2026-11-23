"use client";

import { useEffect, useRef, useState } from "react";
import { markAttendance, startSelfieUpload } from "@/app/actions";

/** Kept exported for the owner's office admin list on the attendance page (the geofence is parked). */
export type Office = { id: string; name: string; lat: number; lng: number; radius_m: number };

/** A quick selfie → saved. No location check for now; the server verifies the selfie was stored. */
export function AttendanceMarker({ kind }: { kind: "check_in" | "check_out" }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "blocked">("off");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  async function openCamera() {
    setMsg(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
      setCamera("on");
    } catch {
      setCamera("blocked");
    }
  }
  useEffect(() => {
    if (camera === "on" && video.current && stream.current) video.current.srcObject = stream.current;
  }, [camera]);
  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  /** Draws the frame plus a strip with the time, so the photo itself carries the proof. */
  async function stamped(source: CanvasImageSource, w: number, h: number): Promise<Blob> {
    const scale = Math.min(1, 1280 / w);
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const g = c.getContext("2d")!;
    g.drawImage(source, 0, 0, c.width, c.height);
    const strip = Math.max(54, Math.round(c.height * 0.11));
    g.fillStyle = "rgba(0,0,0,0.72)";
    g.fillRect(0, c.height - strip, c.width, strip);
    g.fillStyle = "#fc7c0f";
    g.fillRect(0, c.height - strip, 6, strip);
    g.fillStyle = "#fff";
    g.font = `600 ${Math.round(strip * 0.34)}px system-ui, sans-serif`;
    const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }).format(new Date());
    g.fillText(`${kind === "check_in" ? "Check-in" : "Check-out"} · ${when} IST`, 18, c.height - strip * 0.38);
    return new Promise((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
  }

  async function submit(photo: Blob) {
    setMsg(null);
    setBusy("Saving your selfie…");
    const start = await startSelfieUpload(kind, photo.size);
    if (start.error || !start.sessionUrl) return fail(start.error ?? "Couldn't start the upload.");
    const put = await fetch(start.sessionUrl, { method: "PUT", body: photo }).catch(() => null);
    const fileId = put?.ok ? ((await put.json().catch(() => null))?.id as string | undefined) : undefined;
    if (!fileId) return fail("The selfie didn't upload. Check your connection and try again.");
    setBusy("Marking attendance…");
    const done = await markAttendance({ kind, fileId, folderId: start.folderId! });
    setBusy(null);
    if (done?.error) return setMsg({ error: done.error });
    stream.current?.getTracks().forEach((t) => t.stop());
    setCamera("off");
    setMsg({ ok: done?.ok });
  }
  function fail(error: string) {
    setBusy(null);
    setMsg({ error });
  }

  async function capture() {
    const v = video.current!;
    await submit(await stamped(v, v.videoWidth, v.videoHeight));
  }
  async function fromFile(file: File) {
    const img = await createImageBitmap(file);
    await submit(await stamped(img, img.width, img.height));
  }

  const out = kind === "check_out";
  const label = out ? "Check out" : "Check in";
  const done = Boolean(msg?.ok);

  return (
    <div className="space-y-4">
      {/* The one big button */}
      {camera !== "on" && !done && (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void openCamera()}
          className={`flex w-full items-center justify-center gap-3 rounded-3xl px-6 py-6 text-xl font-bold transition disabled:opacity-70 ${
            out ? "bg-[#0d0d10] text-white shadow-[0_18px_36px_-16px_rgba(0,0,0,0.7)]" : "bg-gradient-to-b from-[#ff9234] to-[#fc7c0f] text-[#140a00] shadow-[0_18px_36px_-14px_rgba(252,124,15,0.9)]"
          }`}
        >
          {busy ? <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span> : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {out ? <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9" /> : <path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9" />}
            </svg>
          )}
          {busy ?? label}
        </button>
      )}
      {camera === "off" && !busy && !done && <p className="text-center text-xs text-muted">One tap: take a quick selfie to {out ? "check out" : "check in"}.</p>}

      {/* Selfie */}
      {camera === "on" && (
        <div className="space-y-3">
          <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full -scale-x-100 rounded-3xl bg-black object-cover" />
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={capture}
            className={`flex w-full items-center justify-center gap-3 rounded-3xl px-6 py-5 text-lg font-bold disabled:opacity-70 ${out ? "bg-[#0d0d10] text-white" : "bg-gradient-to-b from-[#ff9234] to-[#fc7c0f] text-[#140a00]"}`}
          >
            {busy ?? `Take selfie & ${label.toLowerCase()}`}
          </button>
        </div>
      )}
      {camera === "blocked" && (
        <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          The camera is blocked in this browser.
          <label className="btn-ghost ml-2 cursor-pointer !py-1 text-xs">
            {busy ?? "Use phone camera"}
            <input type="file" accept="image/*" capture="user" className="hidden" disabled={Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void fromFile(f); }} />
          </label>
        </div>
      )}

      {msg?.error && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{msg.error}</p>}
      {msg?.ok && <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800">{msg.ok}</p>}
      <p className="text-center text-[11px] text-muted">Your photo is stamped with the time and saved privately. Only you and the owners can see it.</p>
    </div>
  );
}
