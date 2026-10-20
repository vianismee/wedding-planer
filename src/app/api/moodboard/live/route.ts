import { getContext } from "@/lib/session";
import { can } from "@/lib/roles";
import { leave, snapshot, subscribeMood } from "@/lib/mood-live";

/**
 * Aliran moodboard (server-sent events): operasi dari anggota lain beserta kursor dan pilihannya.
 * Klien mengirim balik lewat POST /api/moodboard/ops dan /api/moodboard/presence.
 */
export async function GET(req: Request) {
  const ctx = await getContext();
  if (!ctx) return new Response(null, { status: 401 });
  if (!can(ctx.perms, "moodboard")) return new Response(null, { status: 403 });
  const clientId = new URL(req.url).searchParams.get("client") ?? "";
  if (!/^[\w-]{8,64}$/.test(clientId)) return new Response(null, { status: 400 });
  const weddingId = ctx.wedding.id;

  const enc = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      const send = (s: string) => {
        try {
          c.enqueue(enc.encode(s));
        } catch {
          stop();
        }
      };
      const unsubscribe = subscribeMood(weddingId, (e) => send(`data: ${JSON.stringify(e)}\n\n`));
      const ping = setInterval(() => send(": ping\n\n"), 25_000);
      stop = () => {
        clearInterval(ping);
        unsubscribe();
        leave(weddingId, clientId);
      };
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          c.close();
        } catch {}
      });
      send("retry: 2000\n\n");
      send(`data: ${JSON.stringify({ type: "snapshot", presence: snapshot(weddingId) })}\n\n`);
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
