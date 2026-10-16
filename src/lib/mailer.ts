import nodemailer, { type Transporter } from "nodemailer";

type Mail = { to: string | string[]; subject: string; text: string };

let transport: Transporter | null = null;

export async function sendMail({ to, subject, text }: Mail) {
  if (!process.env.SMTP_URL) {
    // Mode development: email dicetak ke log server.
    console.info(`\n[email] Kepada: ${[to].flat().join(", ")}\n[email] Subjek: ${subject}\n${text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.MAIL_FROM ?? "Rukun <noreply@localhost>", to, subject, text });
}
