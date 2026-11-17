"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className="w-[18px] h-[18px]"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

const TABS = [
  { key: "home", label: "Semana" },
  { key: "movs", label: "Movimientos" },
  { key: "cuentas", label: "Tarjeta" },
  { key: "mes", label: "Mes" },
];

export default function HomeShell({ email }: { email: string }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  // Mantiene el <meta theme-color> y el atributo en sync al cargar.
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const t = (document.documentElement.getAttribute("data-theme") ||
      "light") as "light" | "dark";
    setTheme(t);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("feria_theme", next);
    } catch {
      /* ignore */
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await createClient().auth.signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-app px-4 pt-3.5 pb-32 min-h-dvh">
      <header className="flex items-center justify-between mt-0.5 mb-3.5">
        <div className="num font-bold text-[28px] leading-none tracking-tight">
          Feria
          <span className="block font-sans text-xs font-semibold text-mut tracking-normal mt-0.5">
            Control semanal de Israel
          </span>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Modo oscuro"
          className="w-[38px] h-[38px] rounded-xl bg-card border border-line grid place-items-center"
        >
          <MoonIcon />
        </button>
      </header>

      <section className="bg-card border border-line rounded-[18px] p-4 shadow-card mb-3">
        <div className="text-xs font-bold tracking-wider uppercase text-mut">
          Todo listo
        </div>
        <p className="num text-[30px] leading-tight my-2">¡Estás dentro!</p>
        <p className="text-sm text-mut m-0">
          La base ya quedó: diseño, login y tu base de datos privada. Las
          pantallas (movimientos, semana, tarjeta y mes) llegan en los
          siguientes pasos.
        </p>
      </section>

      <section className="bg-card border border-line rounded-[18px] p-4 shadow-card mb-3">
        <div className="text-xs font-bold tracking-wider uppercase text-mut mb-1">
          Tu sesión
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold break-all">{email}</span>
          <button
            onClick={logout}
            disabled={loggingOut}
            className="shrink-0 px-3.5 py-2 rounded-xl bg-bg border border-line text-sm font-bold text-del disabled:opacity-40"
          >
            {loggingOut ? "Saliendo…" : "Cerrar sesión"}
          </button>
        </div>
      </section>

      {/* Barra de pestañas (todavía decorativa; se activa en las siguientes fases) */}
      <nav className="fixed left-0 right-0 bottom-0 z-20 border-t border-line bg-card/90 backdrop-blur px-2.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="max-w-app mx-auto grid grid-cols-4">
          {TABS.map((t, i) => (
            <div
              key={t.key}
              className={`flex flex-col items-center gap-0.5 text-[11px] font-bold py-1 ${
                i === 0 ? "text-ink" : "text-mut"
              }`}
            >
              <span className="w-[22px] h-[22px] rounded-md bg-line/60" />
              {t.label}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
