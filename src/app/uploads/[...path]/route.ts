import { readUpload } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = await readUpload((await params).path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      // Nama file unik per upload, jadi aman di-cache lama.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
