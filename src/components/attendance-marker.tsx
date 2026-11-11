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

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError("This browser can't share its location.");
    navigator.geolocation.getCurrentPosition(
      (p) => setFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => setGeoError(e.code === e.PERMISSION_DENIED ? "Location is blocked. Allow location for this site in your browser settings, then try again." : "Couldn't get your location. Step near a window or turn on GPS and try again."),
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

  const label = kind === "check_in" ? "Check in" : "Check out";
  return (
    <div className="space-y-5">
      {/* Step 1 — location */}
      <div className="well p-5">
        <p className="eyebrow">Step 1 · Where you are</p>
        {!fix ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={locate} className="btn">Use my location</button>
            <span className="text-xs text-muted">You need to be within range of an office.</span>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-lg font-semibold ${inRange ? "text-emerald-700" : "text-red-600"}`}>
                {inRange ? "✓ " : ""}{fmtDist(nearest!.d)} from {nearest!.o.name}
              </p>
              <p className="font-mono text-[11px] text-muted">{fix.lat.toFixed(5)}, {fix.lng.toFixed(5)} · accurate to ±{Math.round(fix.accuracy)} m</p>
              {!inRange && <p className="mt-1 text-xs text-red-600">You need to be within {fmtDist(nearest!.o.radius_m)}. Move closer and refresh.</p>}
            </div>
            <button type="button" onClick={locate} className="btn-ghost">Refresh</button>
          </div>
        )}
        {geoError && <p className="mt-2 text-xs text-red-600">{geoError}</p>}
      </div>

      {/* Step 2 — selfie */}
      <div className={`well p-5 ${inRange ? "" : "pointer-events-none opacity-50"}`}>
        <p className="eyebrow">Step 2 · Selfie</p>
        {camera === "on" ? (
          <div className="mt-3 space-y-3">
            <video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full max-w-md -scale-x-100 rounded-2xl bg-black object-cover" />
            <button type="button" disabled={Boolean(busy)} onClick={capture} className="btn w-full max-w-md !py-3">{busy ?? `Take selfie & ${label.toLowerCase()}`}</button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={!inRange || Boolean(busy)} onClick={openCamera} className="btn-dark">Open camera</button>
            <label className="btn-ghost cursor-pointer">
              {busy ?? "Use phone camera"}
              <input type="file" accept="image/*" capture="user" className="hidden" disabled={!inRange || Boolean(busy)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void fromFile(f); }} />
            </label>
            {camera === "blocked" && <span className="text-xs text-red-600">Camera is blocked. Allow it in the browser, or use “Use phone camera”.</span>}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">The photo is stamped with the time and your location and saved privately. Only you and the owners can see it.</p>
      </div>

      {msg?.error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700">{msg.error}</p>}
      {msg?.ok && <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-800">{msg.ok}</p>}
    </div>
  );
}
