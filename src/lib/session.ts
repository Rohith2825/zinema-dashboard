import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { AccessLevel, Page, PageRole, Profile } from "./types";

/** Everything a screen needs about the signed-in person. Cached per request. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) redirect("/login");

  const [profileRes, membershipsRes, pagesRes, ownerRes, unreadRes, allRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, nickname, handle, bio, email, is_org_admin").eq("id", user.id).maybeSingle(),
    supabase.from("page_members").select("page_id, role").eq("user_id", user.id),
    supabase.from("pages").select("id, slug, name, code_prefix, is_main").order("signoff_rank").order("name"),
    supabase.rpc("is_rights_owner"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("all_page_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  const profile = profileRes.data as Profile | null;
  const memberships = (membershipsRes.data ?? []) as { page_id: string; role: PageRole }[];
  const pages = (pagesRes.data ?? []) as Page[];
  const isAdmin = Boolean(profile?.is_org_admin);

  const allRole = (allRes.data?.role ?? null) as "core" | "viewer" | null;
  const isOwner = ownerRes.data === true;

  /** Mirrors has_page_role_for() in the database: admins pass everything, core covers making and checking, approving is admin-only. */
  const roleOn = (pageId: string, roles: PageRole[]) => {
    if (isAdmin) return true;
    const mine = allRole ?? memberships.find((m) => m.page_id === pageId)?.role;
    if (mine === "viewer") return roles.includes("viewer");
    if (mine === "core") return roles.some((r) => ["core", "maker", "checker", "viewer"].includes(r));
    return false;
  };
  const level: AccessLevel | null = isOwner ? "owner" : isAdmin ? "admin" : allRole ?? (memberships.some((m) => m.role === "core") ? "core" : memberships.length ? "viewer" : null);

  return {
    supabase,
    user,
    profile,
    memberships,
    pages,
    isAdmin,
    isOwner,
    allRole,
    level,
    unread: unreadRes.count ?? 0,
    photo: ((user.user_metadata?.avatar_url ?? user.user_metadata?.picture) as string | undefined) || null,
    hasAccess: level !== null,
    roleOn,
    canWork: (pageId: string) => roleOn(pageId, ["maker"]),
    canCheck: (pageId: string) => roleOn(pageId, ["checker"]),
    canApprove: (pageId: string) => roleOn(pageId, ["approver"]),
  };
});

export type Session = Awaited<ReturnType<typeof getSession>>;

export function pageBySlug(pages: Page[], slug?: string | string[]) {
  return typeof slug === "string" ? pages.find((p) => p.slug === slug) : undefined;
}
