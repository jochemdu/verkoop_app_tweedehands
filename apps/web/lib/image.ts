// Client-side image resize via Canvas API. Houdt alles binnen de browser
// zodat we geen onnodig grote bestanden naar de server sturen.

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

export async function resizeImage(file: File): Promise<Blob> {
  // Skip resize voor kleine files of niet-afbeeldingen.
  if (!file.type.startsWith("image/") || file.size < 200_000) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  if (scale >= 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas toBlob faalde"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

export function filenameFor(index: number, originalName: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const safe = originalName.replace(/[^a-z0-9.]+/gi, "_").slice(-40);
  return `${ts}_${index}_${safe}`;
}
