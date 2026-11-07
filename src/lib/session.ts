import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Page, PageRole, Profile } from "./types";

/** Everything a screen needs about the signed-in person. Cached per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const [profileRes, membershipsRes, pagesRes, ownerRes, unreadRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, is_org_admin").eq("id", user.id).maybeSingle(),
    supabase.from("page_members").select("page_id, role").eq("user_id", user.id),
    supabase.from("pages").select("id, slug, name, code_prefix, is_main").order("signoff_rank").order("name"),
    supabase.rpc("is_rights_owner"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const profile = profileRes.data as Profile | null;
  const memberships = (membershipsRes.data ?? []) as { page_id: string; role: PageRole }[];
  const pages = (pagesRes.data ?? []) as Page[];
  const isAdmin = Boolean(profile?.is_org_admin);

  const roleOn = (pageId: string, roles: PageRole[]) =>
    isAdmin || memberships.some((m) => m.page_id === pageId && roles.includes(m.role));

  return {
    supabase,
    user,
    profile,
    memberships,
    pages,
    isAdmin,
    isOwner: ownerRes.data === true,
    unread: unreadRes.count ?? 0,
    hasAccess: isAdmin || memberships.length > 0,
    roleOn,
    canWork: (pageId: string) => roleOn(pageId, ["page_admin", "approver", "checker", "maker"]),
    canCheck: (pageId: string) => roleOn(pageId, ["page_admin", "approver", "checker"]),
    canApprove: (pageId: string) => roleOn(pageId, ["page_admin", "approver"]),
  };
});

export type Session = Awaited<ReturnType<typeof getSession>>;

export function pageBySlug(pages: Page[], slug?: string | string[]) {
  return typeof slug === "string" ? pages.find((p) => p.slug === slug) : undefined;
}
