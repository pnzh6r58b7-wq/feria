"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email ?? "");
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-dvh grid place-items-center">
        <span className="text-mut text-sm">Cargando…</span>
      </main>
    );
  }

  return <Dashboard email={email ?? ""} />;
}
