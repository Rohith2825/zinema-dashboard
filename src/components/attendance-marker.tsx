"use client";

import { useEffect, useRef, useState } from "react";
import { markAttendance, startSelfieUpload } from "@/app/actions";

export type Office = { id: string; name: string; lat: number; lng: number; radius_m: number };
type Fix = { lat: number; lng: number; accuracy: number };

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

/** Location check → selfie → saved. The server re-checks the distance; this screen just guides the person. */
export function AttendanceMarker({ offices, kind }: { offices: Office[]; kind: "check_in" | "check_out" }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "blocked">("off");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const nearest = fix ? offices.map((o) => ({ o, d: metres(fix, o) })).sort((a, b) => a.d - b.d)[0] : null;
  const inRange = Boolean(nearest && nearest.d <= nearest.o.radius_m);

  const [locating, setLocating] = useState(false);
  /** One tap: find where the person is and, if they're in range, go straight to the selfie. */
  function locate(thenCamera = false) {
    setGeoError(null);
    setMsg(null);
    if (!navigator.geolocation) return setGeoError("This browser can't share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setFix(next);
        setLocating(false);
        const best = offices.map((o) => ({ o, d: metres(next, o) })).sort((a, b) => a.d - b.d)[0];
        if (thenCamera && best && best.d <= best.o.radius_m) void openCamera();
      },
      (e) => { setLocating(false); setGeoError(e.code === e.PERMISSION_DENIED ? "Location is blocked. Allow location for this site in your browser settings, then try again." : "Couldn't get your location. Step near a window or turn on GPS and try again."); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function openCamera() {
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

  /** Draws the frame plus a strip with time, coordinates and office, so the photo itself carries the proof. */
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
    g.font = `600 ${Math.round(strip * 0.3)}px system-ui, sans-serif`;
    const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" }).format(new Date());
    g.fillText(`${kind === "check_in" ? "Check-in" : "Check-out"} · ${when} IST`, 18, c.height - strip * 0.56);
    g.font = `${Math.round(strip * 0.24)}px system-ui, sans-serif`;
    g.fillText(`${fix!.lat.toFixed(5)}, ${fix!.lng.toFixed(5)} (±${Math.round(fix!.accuracy)} m) · ${fmtDist(nearest!.d)} from ${nearest!.o.name}`, 18, c.height - strip * 0.2);
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
    const done = await markAttendance({ kind, lat: fix!.lat, lng: fix!.lng, accuracy: fix!.accuracy, fileId, folderId: start.folderId! });
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
  const started = Boolean(fix) || locating || camera !== "off";

  return (
    <div className="space-y-4">
      {/* The one big button */}
      {camera !== "on" && (
        <button
          type="button"
          disabled={locating || Boolean(busy)}
          onClick={() => (inRange ? void openCamera() : locate(true))}
          className={`flex w-full items-center justify-center gap-3 rounded-3xl px-6 py-6 text-xl font-bold transition disabled:opacity-70 ${
            out ? "bg-[#0d0d10] text-white shadow-[0_18px_36px_-16px_rgba(0,0,0,0.7)]" : "bg-gradient-to-b from-[#ff9234] to-[#fc7c0f] text-[#140a00] shadow-[0_18px_36px_-14px_rgba(252,124,15,0.9)]"
          }`}
        >
          {locating || busy ? <span className="eq-loader" aria-hidden="true"><i /><i /><i /><i /></span> : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {out ? <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h9" /> : <path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9" />}
            </svg>
          )}
          {locating ? "Finding your location…" : (busy ?? label)}
        </button>
      )}
      {!started && <p className="text-center text-xs text-muted">One tap: we check you&apos;re at the office, then take a quick selfie.</p>}

      {/* Where you are */}
      {fix && nearest && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm ${inRange ? "bg-emerald-500/10 text-emerald-800" : "bg-red-500/10 text-red-700"}`}>
          <span>
            <b>{inRange ? "✓ You're at " : "Too far from "}{nearest.o.name}</b>
            <span className="ml-1 opacity-80">· {fmtDist(nearest.d)} away{inRange ? "" : `, needs to be within ${fmtDist(nearest.o.radius_m)}`}</span>
          </span>
          {!inRange && <button type="button" onClick={() => locate(true)} className="btn-ghost !py-1 text-xs">Try again</button>}
        </div>
      )}
      {geoError && <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{geoError}</p>}

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
      {camera === "blocked" && inRange && (
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
      {started && <p className="text-center text-[11px] text-muted">Your photo is stamped with the time and place and saved privately. Only you and the owners can see it.</p>}
    </div>
  );
}
