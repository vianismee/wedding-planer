import { NextResponse } from "next/server";
import { runReminders } from "@/lib/reminders";

// Dipanggil worker (BullMQ) atau cron eksternal sekali sehari.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  const result = await runReminders();
  return NextResponse.json(result);
}
