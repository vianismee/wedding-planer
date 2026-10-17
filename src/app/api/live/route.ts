import { getContext } from "@/lib/session";
import { subscribe } from "@/lib/live";

/**
 * Server-sent events: tiap kali anggota lain menyimpan perubahan, tab yang terbuka
 * menerima sinyal lalu memuat ulang datanya. Isi data tidak dikirim lewat sini.
 */
export async function GET(req: Request) {
  const ctx = await getContext();
  if (!ctx) return new Response(null, { status: 401 });

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
      const unsubscribe = subscribe(ctx.wedding.id, () => send("data: changed\n\n"));
      // Ping supaya koneksi tidak diputus proxy saat sepi.
      const ping = setInterval(() => send(": ping\n\n"), 25_000);
      stop = () => {
        clearInterval(ping);
        unsubscribe();
      };
      req.signal.addEventListener("abort", () => {
        stop();
        try {
          c.close();
        } catch {}
      });
      send("retry: 3000\n\n");
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
