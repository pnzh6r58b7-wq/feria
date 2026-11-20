import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Feria",
  description: "Control semanal de gastos de Israel",
  manifest: "/feria/manifest.webmanifest",
  applicationName: "Feria",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Feria",
  },
  icons: {
    icon: [
      { url: "/feria/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/feria/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/feria/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3EEE5" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1424" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${manrope.variable} ${fraunces.variable}`}>
      <head>
        {/* Aplica el tema guardado antes de pintar, para que no parpadee */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('feria_theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
