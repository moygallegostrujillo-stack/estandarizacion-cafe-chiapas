"use client";
import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      Cerrar sesión
    </button>
  );
}
