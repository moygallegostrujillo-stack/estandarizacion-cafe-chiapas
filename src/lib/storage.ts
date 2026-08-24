// ============================================================
// src/lib/storage.ts — Supabase Storage + compresión sharp
// ============================================================
// Sube fotos de evidencia a Supabase Storage con compresión
// agresiva (máximo 200 KB por foto) usando la librería sharp.
//
// Esto permite mantener el tier gratuito de Supabase (1 GB)
// durante 9+ meses de operación de una sede piloto.

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente con service_role (solo servidor, nunca frontend)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const BUCKET_NAME = "evidencias";

// Configuración de compresión (objetivo: <200 KB por foto)
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 960;
const JPEG_QUALITY = 75;

/**
 * Comprime una imagen antes de subirla.
 * Redimensiona a máximo 1280×960 y comprime a JPEG calidad 75.
 * Resultado: ~150-200 KB por foto.
 */
export async function compressImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, progressive: true })
    .toBuffer();
}

/**
 * Sube una foto de evidencia a Supabase Storage.
 * La imagen se comprime automáticamente antes de subir.
 *
 * @param file Buffer de la imagen original
 * @param checklistItemId ID del ChecklistItem al que pertenece
 * @param subidoPor ID del usuario que sube la foto
 * @returns Objeto con URL pública y metadata
 */
export async function uploadEvidencia(
  file: Buffer,
  checklistItemId: string,
  subidoPor: string
): Promise<{
  url: string;
  thumbnailUrl: string | null;
  size: number;
}> {
  // 1. Comprimir imagen
  const compressed = await compressImage(file);
  const size = compressed.length;

  // Verificar tamaño (no debe exceder 500 KB después de compresión)
  if (size > 500 * 1024) {
    throw new Error(
      `Imagen demasiado grande después de compresión: ${(size / 1024).toFixed(0)} KB. ` +
      `Máximo permitido: 500 KB.`
    );
  }

  // 2. Generar nombre único
  const fileName = `${checklistItemId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  // 3. Subir a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, compressed, {
      contentType: "image/jpeg",
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Error subiendo evidencia: ${uploadError.message}`);
  }

  // 4. Generar URL firmada (válida 1 hora por defecto, ajustable)
  const { data: urlData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(fileName, 3600);

  if (!urlData?.signedUrl) {
    throw new Error("Error generando URL firmada");
  }

  return {
    url: fileName,  // Guardamos el path, no la URL firmada (se regenera al consultar)
    thumbnailUrl: null,
    size,
  };
}

/**
 * Genera una URL firmada temporal para acceder a una evidencia.
 * Válida por el tiempo especificado (default: 1 hora).
 */
export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Error generando URL firmada: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Elimina una evidencia de Storage.
 * Se llama cuando se elimina un ChecklistItem o se reemplaza la foto.
 */
export async function deleteEvidencia(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    console.error("Error eliminando evidencia:", error);
    // No lanzamos error para no interrumpir la operación principal
  }
}

/**
 * Borra evidencias antiguas (política de retención 90 días).
 * Se llama desde un cron job semanal.
 */
export async function cleanupOldEvidencias(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  // Esto requeriría una consulta a la DB para encontrar evidencias viejas
  // y luego eliminar sus archivos en Storage.
  // Por ahora es placeholder — se implementará cuando esté el cron.

  console.log(`[cleanup] Evidencias anteriores a ${cutoffDate.toISOString()} marcadas para borrado`);
  return 0;
}
