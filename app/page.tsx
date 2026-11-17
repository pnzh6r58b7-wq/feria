import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeShell from "@/components/HomeShell";

export default async function Home() {
  const supabase = await createClient();

  let email: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login");
    email = data.user.email ?? null;
  } catch {
    // Error de red (p.ej. Supabase aún sin configurar): lo trata el middleware.
    redirect("/login");
  }

  return <HomeShell email={email ?? ""} />;
}
