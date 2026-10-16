// Worker pengingat termin. Menjalankan /api/cron/reminders setiap hari pukul 08.00 WIB.
// Dengan REDIS_URL: dijadwalkan lewat BullMQ (job berulang, aman bila worker restart).
// Tanpa REDIS_URL: interval sederhana per jam untuk development.

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;

async function trigger() {
  const res = await fetch(`${base}/api/cron/reminders`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  const body = await res.text();
  console.log(`[worker] ${new Date().toISOString()} pengingat termin: ${res.status} ${body}`);
  if (!res.ok) throw new Error(`Gagal: ${res.status}`);
}

async function main() {
  if (!secret) throw new Error("CRON_SECRET wajib diisi untuk worker.");

  if (process.env.REDIS_URL) {
    const { Queue, Worker } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    const queue = new Queue("reminders", { connection });
    await queue.upsertJobScheduler("daily-reminders", { pattern: "0 8 * * *", tz: "Asia/Jakarta" }, { name: "run" });
    new Worker("reminders", trigger, { connection });
    console.log("[worker] BullMQ aktif, jadwal 08.00 WIB setiap hari");
    return;
  }

  console.log("[worker] REDIS_URL kosong, memakai interval per jam");
  await trigger().catch((e) => console.error(e));
  setInterval(() => trigger().catch((e) => console.error(e)), 60 * 60 * 1000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
