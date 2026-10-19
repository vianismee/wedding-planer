import { z } from "zod";
import { getContext } from "@/lib/session";
import { can } from "@/lib/roles";
import { setPresence } from "@/lib/mood-live";
import { presenceColor } from "@/lib/moodboard";
import { boardId } from "@/lib/moodboard-schema";

const num = z.number().finite().min(-1e6).max(1e6);
const rect = z.object({ x: num, y: num, w: num, h: num });
const body = z.object({
  clientId: z.string().regex(/^[\w-]{8,64}$/),
  board: boardId,
  cursor: z.object({ x: num, y: num }).nullable(),
  sel: z.array(z.string().max(64)).max(300),
  view: rect.nullable(),
  moving: z.record(z.string().max(64), z.object({ x: num, y: num, w: num.optional(), h: num.optional() })).nullable(),
});

/** Kursor, pilihan, dan tampilan layar satu tab. Tidak disimpan ke database. */
export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx) return new Response(null, { status: 401 });
  if (!can(ctx.member.role, "moodboard")) return new Response(null, { status: 403 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return new Response(null, { status: 400 });
  if (p.data.moving && Object.keys(p.data.moving).length > 300) return new Response(null, { status: 400 });
  setPresence(ctx.wedding.id, {
    ...p.data,
    userId: ctx.user.id,
    name: ctx.user.name,
    color: presenceColor(ctx.user.id),
    t: Date.now(),
  });
  return new Response(null, { status: 204 });
}
