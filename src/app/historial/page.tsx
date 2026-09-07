import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import HistorialClient from "./HistorialClient";

export default async function HistorialPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <HistorialClient rol={user.rol} />;
}
