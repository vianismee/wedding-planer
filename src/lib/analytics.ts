// Event analytics tanpa data pribadi: hanya id pernikahan, peran, dan hitungan.
// Bila UMAMI_URL dan UMAMI_WEBSITE_ID diisi, event dikirim ke Umami self-hosted.

type Props = { weddingId: string; role?: string; count?: number };

export function track(name: string, props: Props) {
  if (!process.env.UMAMI_URL || !process.env.UMAMI_WEBSITE_ID) {
    if (process.env.NODE_ENV !== "production") console.info(`[analytics] ${name}`, props);
    return;
  }
  fetch(`${process.env.UMAMI_URL}/api/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "rukun-server" },
    body: JSON.stringify({ type: "event", payload: { website: process.env.UMAMI_WEBSITE_ID, name, data: props, url: "/" } }),
  }).catch(() => {});
}
