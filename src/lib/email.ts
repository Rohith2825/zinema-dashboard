import "server-only";
import { SITE_URL } from "./site";

/** Email through Resend. Env: RESEND_API_KEY, and optionally EMAIL_FROM (must be on a domain verified in Resend). */
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "Zinema OS <notifications@zinema.music>";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Notice = { to_email: string; to_name: string | null; kind: string; body: string; song_code: string | null; song_title: string | null };

const HEADLINE: Record<string, string> = {
  mention: "You were mentioned",
  task_assigned: "A task was assigned to you",
  file_to_check: "A file is waiting for your check",
  file_approved: "Your file was approved",
  changes_requested: "Changes were requested on your file",
};

export function noticeEmail(n: Notice) {
  const headline = HEADLINE[n.kind] ?? "Something needs your attention";
  const song = n.song_code ? `${n.song_code} · ${n.song_title ?? ""}`.trim() : null;
  const link = n.song_code ? `${SITE_URL}/songs/${n.song_code}` : `${SITE_URL}/inbox`;
  const subject = song ? `${headline} · ${n.song_code}` : headline;
  const text = `${headline}${song ? ` on ${song}` : ""}\n\n${n.body}\n\nOpen in Zinema OS: ${link}\n\nYou can turn these emails off on your profile: ${SITE_URL}/profile`;
  const html = `<!doctype html><html><body style="margin:0;background:#eceef2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d0d10">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
  <p style="margin:0 0 16px;font-size:13px;font-weight:800;letter-spacing:3px">ZINEMA <span style="color:#fc7c0f">OS</span></p>
  <div style="background:#ffffff;border-radius:20px;padding:28px">
    <p style="margin:0;font-size:12px;color:#6c7079">${n.to_name ? `Hi ${esc(n.to_name.split(" ")[0])},` : "Hi,"}</p>
    <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3">${esc(headline)}</h1>
    ${song ? `<p style="margin:6px 0 0;font-size:13px;color:#6c7079">${esc(song)}</p>` : ""}
    <p style="margin:18px 0 0;padding:14px 16px;background:#f1f2f6;border-left:4px solid #fc7c0f;border-radius:10px;font-size:15px;line-height:1.5">${esc(n.body)}</p>
    <p style="margin:24px 0 0"><a href="${link}" style="display:inline-block;background:#fc7c0f;color:#140a00;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">Open in Zinema OS</a></p>
  </div>
  <p style="margin:16px 4px 0;font-size:11px;color:#6c7079;line-height:1.6">You're getting this because you're on the Zinema Music team. <a href="${SITE_URL}/profile" style="color:#6c7079">Turn these emails off</a> on your profile.</p>
</div></body></html>`;
  return { subject, text, html };
}

export async function sendEmail(to: string, mail: { subject: string; text: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "RESEND_API_KEY is not set" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (res.ok) return { ok: true };
  const detail = await res.json().catch(() => null);
  return { ok: false, error: detail?.message ?? `Resend answered ${res.status}` };
}

/** Messages a person writes to the team go from the brand address; replies go to the person who wrote it. */
const TEAM_FROM = process.env.TEAM_EMAIL_FROM || "Zinema Music <brands@zinema.music>";

export function teamEmail(m: { subject: string; body: string; from: string; to: string | null }) {
  const text = `${m.to ? `Hi ${m.to.split(" ")[0]},` : "Hi,"}\n\n${m.body}\n\n${m.from}\nZinema Music\n\nSent to the team through Zinema OS: ${SITE_URL}/inbox`;
  const html = `<!doctype html><html><body style="margin:0;background:#eceef2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d0d10">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
  <p style="margin:0 0 16px;font-size:13px;font-weight:800;letter-spacing:3px">ZINEMA <span style="color:#fc7c0f">MUSIC</span></p>
  <div style="background:#ffffff;border-radius:20px;padding:28px">
    <p style="margin:0;font-size:12px;color:#6c7079">${m.to ? `Hi ${esc(m.to.split(" ")[0])},` : "Hi,"}</p>
    <h1 style="margin:8px 0 0;font-size:20px;line-height:1.3">${esc(m.subject)}</h1>
    <p style="margin:18px 0 0;font-size:15px;line-height:1.6;white-space:pre-line">${esc(m.body)}</p>
    <p style="margin:22px 0 0;font-size:14px;color:#6c7079">${esc(m.from)}<br>Zinema Music</p>
  </div>
  <p style="margin:16px 4px 0;font-size:11px;color:#6c7079;line-height:1.6">Sent to the Zinema Music team through <a href="${SITE_URL}/inbox" style="color:#6c7079">Zinema OS</a>. Reply to this email to answer ${esc(m.from.split(" ")[0])}.</p>
</div></body></html>`;
  return { subject: m.subject, text, html };
}

/** Sends one copy each to several people in a single request. */
export async function sendTeamEmails(mails: { to: string; subject: string; text: string; html: string }[], replyTo: string | null): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "RESEND_API_KEY is not set" };
  if (!mails.length) return { ok: true };
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(mails.slice(0, 100).map((m) => ({ from: TEAM_FROM, to: [m.to], subject: m.subject, text: m.text, html: m.html, ...(replyTo ? { reply_to: replyTo } : {}) }))),
  });
  if (res.ok) return { ok: true };
  const detail = await res.json().catch(() => null);
  return { ok: false, error: detail?.message ?? `Resend answered ${res.status}` };
}
