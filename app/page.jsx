import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { createClient } from "../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  // Until Supabase is connected, show the original interactive demo.
  if (!configured) {
    return <DashboardClient userName="Аружан" authEnabled={false} />;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const claims = data.claims;
  const userName =
    claims.user_metadata?.full_name ||
    claims.email?.split("@")[0] ||
    "Студент";

  return <DashboardClient userName={userName} authEnabled userId={claims.sub} />;
}
