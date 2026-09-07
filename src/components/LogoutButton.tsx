"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  async function handle() {
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      // Fallback si falla (ej. sin internet) — limpia cookie local y redirige
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      window.location.href = "/login";
    }
  }
  return (
    <button onClick={handle} className="text-sm text-gray-600 hover:text-gray-900">
      Cerrar sesión
    </button>
  );
}
