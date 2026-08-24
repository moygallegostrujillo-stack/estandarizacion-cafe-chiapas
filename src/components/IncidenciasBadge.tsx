"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function IncidenciasBadge() {
  const [count, setCount] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/incidencias?cerrado=false", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {}
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // 30s polling
    return () => clearInterval(id);
  }, []);

  if (count === null || count === 0) {
    return (
      <Link href="/incidencias" className="text-sm text-zinc-400 hover:text-white transition">
        Incidencias
      </Link>
    );
  }

  return (
    <Link href="/incidencias" className="relative text-sm text-amber-300 hover:text-amber-200 transition font-medium">
      Incidencias
      <span className="ml-2 inline-flex items-center justify-center bg-red-600 text-white text-xs font-bold rounded-full h-5 min-w-5 px-1.5">
        {count > 99 ? "99+" : count}
      </span>
      <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
    </Link>
  );
}
