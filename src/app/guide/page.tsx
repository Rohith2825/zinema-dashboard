import { redirect } from "next/navigation";

// The guidebook lives inside the dashboard now. Old links land there (after sign-in).
export default function Guide() {
  redirect("/help");
}
