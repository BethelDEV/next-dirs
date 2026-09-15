import { boundedBody } from "@/lib/bounded-body";
import { requireActor } from "@/services/listing-actions";
import { uploadImage } from "@/services/uploads";
export async function POST(request: Request) {
  try {
    const { db, actor } = await requireActor();
    const bytes = await boundedBody(request, 5 * 1024 * 1024 + 16384);
    const form = await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ error: "An image is required" }, { status: 400 });
    const asset = await uploadImage(
      db,
      actor,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );
    return Response.json({ asset });
  } catch {
    return Response.json({ error: "Image upload failed" }, { status: 400 });
  }
}
