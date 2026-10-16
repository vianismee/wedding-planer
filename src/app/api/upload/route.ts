import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { getContext } from "@/lib/session";
import { can, FILE_AREA } from "@/lib/roles";
import { ALLOWED_MIME, MAX_UPLOAD, putObject } from "@/lib/storage";


export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return NextResponse.json({ error: "Kamu perlu masuk dulu." }, { status: 401 });

  const form = await req.formData();
  const upload = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const area = FILE_AREA[kind];
  if (!area) return NextResponse.json({ error: "Jenis file tidak dikenal." }, { status: 400 });
  if (!can(ctx.member.role, area)) return NextResponse.json({ error: "Peranmu tidak boleh mengunggah file ini." }, { status: 403 });
  if (!(upload instanceof File)) return NextResponse.json({ error: "Pilih file terlebih dulu." }, { status: 400 });
  if (upload.size > MAX_UPLOAD) return NextResponse.json({ error: "Ukuran file maksimal 10 MB." }, { status: 400 });
  if (!ALLOWED_MIME.includes(upload.type))
    return NextResponse.json({ error: "Format file harus JPG, PNG, WEBP, HEIC, atau PDF." }, { status: 400 });

  const id = crypto.randomUUID();
  const key = `${ctx.wedding.id}/${kind}/${id}`;
  await putObject(key, Buffer.from(await upload.arrayBuffer()), upload.type);
  await db.insert(schema.file).values({
    id,
    weddingId: ctx.wedding.id,
    key,
    name: upload.name.slice(0, 200),
    mime: upload.type,
    size: upload.size,
    kind,
    uploadedBy: ctx.user.id,
  });
  return NextResponse.json({ id, name: upload.name });
}
