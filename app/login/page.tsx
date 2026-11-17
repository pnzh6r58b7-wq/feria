"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError(
          error.message.toLowerCase().includes("invalid")
            ? "Correo o contraseña incorrectos."
            : "No se pudo entrar. Revisa tu conexión e inténtalo de nuevo."
        );
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(
        "No se pudo conectar con el servidor. Falta configurar Supabase."
      );
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh mx-auto max-w-app px-4 py-10 flex flex-col justify-center">
      <div className="mb-8 text-center">
        <h1 className="num font-bold text-[40px] leading-none tracking-tight">
          Feria
        </h1>
        <p className="mt-1 text-sm text-mut font-semibold">
          Control semanal de Israel
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-card border border-line rounded-[18px] p-5 shadow-card"
      >
        <label className="block mb-3">
          <span className="block text-xs font-bold text-mut mb-1.5">Correo</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl border border-line bg-bg text-base outline-none focus:border-ink"
            placeholder="tucorreo@ejemplo.com"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-xs font-bold text-mut mb-1.5">
            Contraseña
          </span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-xl border border-line bg-bg text-base outline-none focus:border-ink"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <div className="mb-4 text-sm font-semibold text-del bg-wine-s/40 rounded-xl p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="block w-full p-3.5 rounded-xl bg-ink text-bg font-extrabold text-base disabled:opacity-40"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-mut">
        App privada · solo para Israel
      </p>
    </main>
  );
}
