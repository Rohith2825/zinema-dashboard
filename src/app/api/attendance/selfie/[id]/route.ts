import { downloadFile } from "@/lib/google-drive";
import { createClient } from "@/utils/supabase/server";

/** Shows an attendance selfie to the person it belongs to and to owners (row-level security decides), without sharing the Drive file. */
export async function GET(_: Request, { params }: RouteContext<"/api/attendance/selfie/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("attendance").select("selfie_file_id").eq("id", id).maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  try {
    const file = await downloadFile(data.selfie_file_id);
    return new Response(file.body, { headers: { "Content-Type": file.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("Unavailable", { status: 502 });
  }
}
