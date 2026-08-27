import type { Metadata } from "next";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";

export const metadata: Metadata = {
  title: "Café DeChiapas - Estandarización",
  description: "Sistema de estandarización operativa multi-sede - 54 procesos",
  manifest: "/manifest.json",
  themeColor: "#f59e0b",
  appleWebApp: { capable: true, title: "CafeDeChiapas", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <SessionWrapper>{children}</SessionWrapper>
        <script dangerouslySetInnerHTML={{ __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}` }} />
      </body>
    </html>
  );
}
