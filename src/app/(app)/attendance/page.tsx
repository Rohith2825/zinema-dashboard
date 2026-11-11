import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { addOffice, setOfficeActive } from "@/app/actions";
import { AttendanceSwitch } from "@/components/attendance-switch";
import { ActionForm, Submit } from "@/components/action-form";
import { AttendanceMarker, type Office } from "@/components/attendance-marker";
import { ListSkeleton } from "@/components/skeletons";
import { Avatar, Badge, Empty, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/session";
import { TZ, fmtDate, selfiesPurged, shortName, type Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  return (
    <Suspense fallback={<ListSkeleton label="Loading attendance" rows={5} />}>
      <Attendance searchParams={searchParams} />
    </Suspense>
  );
}

type Row = { id: string; user_id: string; kind: "check_in" | "check_out"; day: string; at: string; lat: number; lng: number; distance_m: number; accuracy_m: number | null; office: { name: string } | null };
type OfficeRow = Office & { address: string | null; maps_url: string | null; active: boolean };

const time = (d: string) => fmtDate(d, { hour: "2-digit", minute: "2-digit" });
const mapLink = (r: { lat: number; lng: number }) => `https://www.google.com/maps?q=${r.lat},${r.lng}`;

async function Attendance({ searchParams }: Pick<PageProps<"/attendance">, "searchParams">) {
  const sp = await searchParams;
  const s = await getSession();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 30);
  const since = from.toISOString().slice(0, 10);

  const [officesR, membersR, mineR, dayR, peopleR] = await Promise.all([
    s.supabase.from("office_locations").select("id, name, address, maps_url, lat, lng, radius_m, active").order("name"),
    s.supabase.from("attendance_members").select("user_id"),
    s.supabase.from("attendance").select("id, user_id, kind, day, at, lat, lng, distance_m, accuracy_m, office:office_locations(name)").eq("user_id", s.user.id).gte("day", since).order("at", { ascending: false }),
    s.isOwner
      ? s.supabase.from("attendance").select("id, user_id, kind, day, at, lat, lng, distance_m, accuracy_m, office:office_locations(name)").eq("day", day).order("at")
      : Promise.resolve({ data: [] }),
    s.isOwner ? s.supabase.from("profiles").select("id, full_name, nickname, handle, bio, email, is_org_admin").order("full_name") : Promise.resolve({ data: [] }),
  ]);
  const offices = (officesR.data ?? []) as OfficeRow[];
  const required = new Set((membersR.data ?? []).map((m) => m.user_id));
  const mine = (mineR.data ?? []) as unknown as Row[];
  const dayRows = (dayR.data ?? []) as unknown as Row[];
  const people = (peopleR.data ?? []) as Profile[];
  const iAmRequired = required.has(s.user.id);
  const myToday = mine.filter((r) => r.day === today);
  const checkIn = myToday.find((r) => r.kind === "check_in");
  const checkOut = myToday.find((r) => r.kind === "check_out");
  const activeOffices = offices.filter((o) => o.active);
  const expected = people.filter((p) => required.has(p.id));

  return (
    <>
      <PageTitle title="Attendance" sub="Mark your day from the office: your location is checked, and a time-stamped selfie is saved as proof." />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-8">
          {/* My day */}
          <section className="card p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Today · {fmtDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {!iAmRequired ? "Attendance isn't required for you" : checkOut ? "Day complete" : checkIn ? "You're checked in" : "Not checked in yet"}
                </h2>
              </div>
              {checkIn && <Badge tone="green">In {time(checkIn.at)}{checkOut ? ` · Out ${time(checkOut.at)}` : ""}</Badge>}
            </div>

            {iAmRequired && checkIn && (
              <div className="mt-5 flex flex-wrap gap-4">
                {[checkIn, checkOut].filter(Boolean).map((r) => (
                  <a key={r!.id} href={`/api/attendance/selfie/${r!.id}`} target="_blank" rel="noreferrer" className="tile flex items-center gap-3 p-2 pr-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/attendance/selfie/${r!.id}`} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    <span className="text-xs">
                      <span className="block font-semibold">{r!.kind === "check_in" ? "Check-in" : "Check-out"} · {time(r!.at)}</span>
                      <span className="text-muted">{r!.office?.name} · {r!.distance_m} m away</span>
                    </span>
                  </a>
                ))}
              </div>
            )}

            {iAmRequired && !checkOut && (
              <div className="mt-6">
                {activeOffices.length === 0 ? (
                  <Empty>No office locations have been added yet. Ask an owner to add one.</Empty>
                ) : (
                  <AttendanceMarker key={checkIn ? "out" : "in"} offices={activeOffices} kind={checkIn ? "check_out" : "check_in"} />
                )}
              </div>
            )}
            {!iAmRequired && <p className="mt-3 text-sm text-muted">An owner switches attendance on per person. If you think it should be on for you, write to info@zinema.music.</p>}
          </section>

          {/* Owners: the day's register */}
          {s.isOwner && (
            <section className="card p-5 md:p-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Register <Badge tone="violet">owners only</Badge></p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {new Set(dayRows.filter((r) => r.kind === "check_in").map((r) => r.user_id)).size} of {expected.length} present · {fmtDate(`${day}T12:00:00+05:30`, { weekday: "short", day: "numeric", month: "short" })}
                  </h2>
                </div>
                <form action="/attendance" className="flex w-full gap-2 sm:w-auto">
                  <input type="date" name="day" defaultValue={day} max={today} className="input w-44" aria-label="Day" />
                  <button className="btn-ghost">Show</button>
                </form>
              </div>
              {selfiesPurged(day, today) && <p className="mt-3 text-xs text-muted">Selfies for this month have been removed (they&apos;re kept for the month plus 5 days). Times and locations stay on record.</p>}
              <ul className="mt-5 divide-y divide-black/[0.06]">
                {expected.map((p) => {
                  const cin = dayRows.find((r) => r.user_id === p.id && r.kind === "check_in");
                  const cout = dayRows.find((r) => r.user_id === p.id && r.kind === "check_out");
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <Avatar name={p.full_name} email={p.email} size={38} />
                      <div className="min-w-0 flex-1 basis-[calc(100%-4rem)] sm:basis-40">
                        <p className="truncate text-sm font-medium">{shortName(p)}</p>
                        <p className="truncate text-xs text-muted">
                          {cin ? <>{cin.office?.name} · {cin.distance_m} m · <a className="underline" href={mapLink(cin)} target="_blank" rel="noreferrer">map</a></> : "No check-in"}
                        </p>
                      </div>
                      {[cin, cout].map((r, i) =>
                        r && selfiesPurged(r.day, today) ? (
                          <span key={r.id} className="w-[88px] text-xs"><span className="block text-muted">{i === 0 ? "In" : "Out"}</span><span className="font-semibold">{time(r.at)}</span></span>
                        ) : r ? (
                          <a key={r.id} href={`/api/attendance/selfie/${r.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs" title="Open selfie">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/attendance/selfie/${r.id}`} alt="" loading="lazy" className="h-10 w-10 rounded-lg bg-black/10 object-cover" />
                            <span><span className="block text-muted">{i === 0 ? "In" : "Out"}</span><span className="font-semibold">{time(r.at)}</span></span>
                          </a>
                        ) : (
                          <span key={i} className="w-[88px] text-xs text-zinc-400">{i === 0 ? "In" : "Out"} —</span>
                        ),
                      )}
                      <Badge tone={cin ? "green" : day === today ? "amber" : "red"}>{cin ? "Present" : day === today ? "Not yet" : "Absent"}</Badge>
                    </li>
                  );
                })}
                {expected.length === 0 && <li className="py-6 text-center text-sm text-muted">Nobody is required to mark attendance yet. Switch it on for people on the right.</li>}
              </ul>
            </section>
          )}

          {/* My history */}
          {iAmRequired && (
            <section className="card p-5 md:p-7">
              <p className="eyebrow">My last 30 days</p>
              <ul className="mt-4 divide-y divide-black/[0.06] text-sm">
                {[...new Set(mine.map((r) => r.day))].map((d) => {
                  const a = mine.find((r) => r.day === d && r.kind === "check_in");
                  const b = mine.find((r) => r.day === d && r.kind === "check_out");
                  return (
                    <li key={d} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="font-medium">{fmtDate(`${d}T12:00:00+05:30`, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="text-xs text-muted">{a?.office?.name}</span>
                      <span className="font-mono text-xs">{a ? time(a.at) : "—"} → {b ? time(b.at) : "—"}</span>
                    </li>
                  );
                })}
                {mine.length === 0 && <li className="py-4 text-muted">Nothing yet.</li>}
              </ul>
            </section>
          )}
        </div>

        {/* Owner controls */}
        <div className="space-y-8">
          <section className="card p-5 md:p-6">
            <p className="eyebrow">Offices</p>
            <ul className="mt-4 space-y-3">
              {offices.map((o) => (
                <li key={o.id} className={`tile flex items-center justify-between gap-3 px-4 py-3 ${o.active ? "" : "opacity-50"}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.name}</p>
                    <p className="text-xs text-muted">
                      within {o.radius_m >= 1000 ? `${o.radius_m / 1000} km` : `${o.radius_m} m`} ·{" "}
                      <Link href={o.maps_url ?? mapLink(o)} target="_blank" className="underline">map</Link>
                    </p>
                  </div>
                  {s.isOwner && (
                    <ActionForm action={setOfficeActive}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="active" value={o.active ? "0" : "1"} />
                      <Submit className="btn-ghost !px-2.5 !py-1 text-xs">{o.active ? "Turn off" : "Turn on"}</Submit>
                    </ActionForm>
                  )}
                </li>
              ))}
              {offices.length === 0 && <li className="text-sm text-muted">No offices yet.</li>}
            </ul>
            {s.isOwner && (
              <ActionForm action={addOffice} resetOnSuccess className="mt-5 space-y-2 border-t border-black/[0.06] pt-5">
                <p className="label">Add an office</p>
                <input name="name" placeholder="Name, e.g. Chennai studio" className="input" required />
                <input name="location" placeholder="Google Maps link, or 13.0827, 80.2707" className="input" required />
                <div className="flex gap-2">
                  <select name="radius_m" className="input" defaultValue="1000" aria-label="Allowed distance">
                    <option value="200">Within 200 m</option>
                    <option value="500">Within 500 m</option>
                    <option value="1000">Within 1 km</option>
                    <option value="2000">Within 2 km</option>
                  </select>
                  <Submit>Add</Submit>
                </div>
              </ActionForm>
            )}
          </section>

          {s.isOwner && (
            <section className="card p-5 md:p-6">
              <p className="eyebrow">Who must mark attendance</p>
              <p className="mt-1 text-xs text-muted">{required.size} of {people.length} switched on</p>
              <ul className="mt-4 space-y-2">
                {people.map((p) => {
                  const on = required.has(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-3">
                      <Avatar name={p.full_name} email={p.email} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{shortName(p)}</p>
                        <p className="truncate text-xs text-muted">{p.email}</p>
                      </div>
                      <AttendanceSwitch userId={p.id} name={shortName(p)} on={on} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
