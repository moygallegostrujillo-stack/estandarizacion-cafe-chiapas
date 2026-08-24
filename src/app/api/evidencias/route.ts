import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { uploadEvidencia } from "@/lib/storage";
import { NextResponse } from "next/server";

// POST /api/evidencias - formData: file, checklistItemId
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const checklistItemId = formData.get("checklistItemId") as string | null;

  if (!file || !checklistItemId) {
    return NextResponse.json({ error: "file y checklistItemId requeridos" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Archivo máximo 10MB" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Solo imágenes" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
      // Validar item pertenece a checklist de la sede y obtener checklist
      const item = await tx.checklistItem.findUnique({
        where: { id: checklistItemId },
        include: { checklist: true },
      });
      if (!item) throw new Error("Item no encontrado");

      // Subir a Storage (sharp comprime a ~200KB)
      const upload = await uploadEvidencia(buffer, checklistItemId, user.id);

      // Registrar en DB
      const evidencia = await tx.evidencia.create({
        data: {
          checklistItemId,
          url: upload.url,
          tipo: "foto",
          size: upload.size,
          subidoPor: user.id,
        },
      });

      // Marcar item como con valor FOTO si lo requiere
      if (item.evidenciaRequerida) {
        await tx.checklistItem.update({
          where: { id: checklistItemId },
          data: { valor: upload.url },
        });
      }

      return evidencia;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error subiendo evidencia";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
