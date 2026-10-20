import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// Mengambil foto dan video dari link (Instagram, Pinterest, atau halaman apa pun dengan og:image/og:video)
// untuk kartu media moodboard. Link berasal dari pengguna, jadi setiap permintaan, termasuk setiap
// redirect, diperiksa supaya tidak bisa diarahkan ke jaringan internal server.

export type LinkItem = { url: string; kind: "image" | "video"; w?: number; h?: number };
export type LinkResult = { title: string; items: LinkItem[] };

export class LinkError extends Error {}

export const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const VIDEO_MIME = ["video/mp4", "video/webm"];
export const MAX_IMAGE = 10 * 1024 * 1024;
export const MAX_VIDEO = 60 * 1024 * 1024;
const MAX_ITEMS = 20;

// Instagram dan beberapa situs hanya memberi data postingan lengkap ke crawler mesin pencari tanpa login.
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const PREVIEW_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
// Sebagian situs (Wikimedia, dll.) menolak UA crawler; dipakai untuk mengunduh file dan mencoba ulang halaman.
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, bits, "ipv6");

function privateAddress(a: string) {
  const v4 = a.startsWith("::ffff:") ? a.slice(7) : a;
  return isIP(v4) === 4 ? blocked.check(v4, "ipv4") : blocked.check(a, "ipv6");
}

async function assertPublic(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new LinkError("Link harus diawali http:// atau https://.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new LinkError("Link ini tidak bisa diambil.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new LinkError("Alamat situs tidak ditemukan. Periksa lagi linknya.");
  if (addrs.some((x) => privateAddress(x.address))) throw new LinkError("Link ini tidak bisa diambil.");
}

/** fetch yang mengikuti redirect sendiri (maksimal 5) dan memeriksa setiap alamat tujuan. */
export async function safeFetch(url: string, init: RequestInit & { timeout?: number } = {}) {
  let u = new URL(url);
  for (let hop = 0; hop < 6; hop++) {
    await assertPublic(u);
    const res = await fetch(u, { ...init, redirect: "manual", signal: AbortSignal.timeout(init.timeout ?? 15_000) });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      u = new URL(loc, u);
      continue;
    }
    return { res, url: u };
  }
  throw new LinkError("Link terlalu banyak dialihkan.");
}

/** Baca isi respons dengan batas ukuran, berhenti begitu terlewati. */
async function readLimited(res: Response, max: number) {
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > max) throw new LinkError(`File lebih dari ${Math.round(max / 1024 / 1024)} MB.`);
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new LinkError(`File lebih dari ${Math.round(max / 1024 / 1024)} MB.`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function getText(url: string, ua: string) {
  const get = (agent: string) => safeFetch(url, { headers: { "User-Agent": agent, "Accept-Language": "id,en;q=0.8" } });
  let { res, url: final } = await get(ua);
  if (res.status === 403 && ua !== BROWSER_UA) {
    await res.body?.cancel();
    ({ res, url: final } = await get(BROWSER_UA));
  }
  if (!res.ok) throw new LinkError(res.status === 404 ? "Halaman tidak ditemukan. Mungkin postingannya sudah dihapus." : "Situs menolak permintaan. Coba lagi nanti.");
  const type = res.headers.get("content-type") ?? "";
  return { text: (await readLimited(res, 8 * 1024 * 1024)).toString("utf8"), type, url: final };
}

/** Unduh satu foto atau video. Jenisnya dicek dari Content-Type, bukan dari link. */
export async function download(item: LinkItem) {
  const { res } = await safeFetch(item.url, { headers: { "User-Agent": BROWSER_UA }, timeout: item.kind === "video" ? 180_000 : 60_000 });
  if (!res.ok) throw new LinkError("Foto atau video di link ini tidak bisa diunduh.");
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const kind = IMAGE_MIME.includes(mime) ? "image" : VIDEO_MIME.includes(mime) ? "video" : null;
  if (!kind) {
    await res.body?.cancel();
    throw new LinkError("Isi link ini bukan foto atau video yang bisa ditampilkan.");
  }
  const body = await readLimited(res, kind === "video" ? MAX_VIDEO : MAX_IMAGE);
  return { body, mime, kind } as const;
}

/* ---------- Instagram ---------- */

type IgMedia = {
  media_type?: number;
  original_width?: number;
  original_height?: number;
  image_versions2?: { candidates?: { url: string; width: number; height: number }[] };
  video_versions?: { url: string; width: number; height: number }[];
  carousel_media?: IgMedia[];
  caption?: { text?: string } | null;
  user?: { username?: string };
};

function findKey(o: unknown, key: string, depth = 0): unknown {
  if (!o || typeof o !== "object" || depth > 40) return undefined;
  if (key in o) return (o as Record<string, unknown>)[key];
  for (const v of Object.values(o)) {
    const x = findKey(v, key, depth + 1);
    if (x !== undefined) return x;
  }
}

const best = <T extends { width: number }>(list?: T[]) => (list?.length ? [...list].sort((a, b) => b.width - a.width)[0] : undefined);

async function instagram(code: string): Promise<LinkResult> {
  const { text } = await getText(`https://www.instagram.com/p/${code}/`, BOT_UA);
  let post: IgMedia | undefined;
  for (const m of text.matchAll(/<script\b[^>]*\bdata-sjs[^>]*>(\{.+?\})<\/script>/g)) {
    if (!m[1].includes("xig_polaris_media")) continue;
    const media = findKey(JSON.parse(m[1]), "xig_polaris_media") as { if_not_gated_logged_out?: IgMedia } | undefined;
    post = media?.if_not_gated_logged_out;
    if (post) break;
  }
  if (!post) {
    // Data lengkap tidak ada (format halaman berubah atau dibatasi): pakai gambar pratinjau saja.
    const og = await openGraph(`https://www.instagram.com/p/${code}/`);
    if (og.items.length) return og;
    throw new LinkError("Postingan Instagram ini tidak bisa dibuka tanpa login. Mungkin akunnya privat.");
  }
  const items: LinkItem[] = [];
  for (const m of post.carousel_media?.length ? post.carousel_media : [post]) {
    const w = m.original_width;
    const h = m.original_height;
    const v = m.media_type === 2 ? best(m.video_versions) : undefined;
    if (v) items.push({ url: v.url, kind: "video", w, h });
    else {
      const img = best(m.image_versions2?.candidates);
      if (img) items.push({ url: img.url, kind: "image", w: w ?? img.width, h: h ?? img.height });
    }
  }
  const caption = post.caption?.text?.split("\n")[0]?.trim();
  return { title: caption || (post.user?.username ? `@${post.user.username}` : "Instagram"), items };
}

/* ---------- Pinterest ---------- */

type PinImage = { url: string; width?: number; height?: number };
type PinVideoList = Record<string, { url: string; width?: number; height?: number }>;

function pinVideo(list?: PinVideoList | null): LinkItem | undefined {
  const mp4 = Object.values(list ?? {}).filter((v) => v?.url && /\.mp4(\?|$)/.test(v.url));
  const v = best(mp4.map((x) => ({ ...x, width: x.width ?? 0 })));
  return v && { url: v.url, kind: "video", w: v.width || undefined, h: v.height };
}
const pinImage = (img?: PinImage | null): LinkItem | undefined => (img?.url ? { url: img.url, kind: "image", w: img.width, h: img.height } : undefined);

async function pinterest(id: string): Promise<LinkResult> {
  const u = new URL("https://www.pinterest.com/resource/PinResource/get/");
  u.searchParams.set("data", JSON.stringify({ options: { field_set_key: "unauth_react_main_pin", id } }));
  const { res } = await safeFetch(u.toString(), { headers: { "X-Pinterest-PWS-Handler": "www/[username].js", "User-Agent": PREVIEW_UA } });
  if (!res.ok) throw new LinkError(res.status === 404 ? "Pin tidak ditemukan. Mungkin sudah dihapus." : "Pinterest menolak permintaan. Coba lagi nanti.");
  const json = JSON.parse((await readLimited(res, 8 * 1024 * 1024)).toString("utf8"));
  const d = json?.resource_response?.data;
  if (!d) throw new LinkError("Pin ini tidak bisa dibuka.");

  const items: LinkItem[] = [];
  const video = pinVideo(d.videos?.video_list);
  if (video) items.push(video);
  // Idea pin: beberapa halaman, masing-masing berisi video atau gambar.
  for (const page of d.story_pin_data?.pages ?? []) {
    let item: LinkItem | undefined;
    for (const b of page.blocks ?? []) item ??= pinVideo(b.video?.video_list) ?? pinImage(b.image?.images?.originals);
    item ??= pinImage(page.image_adjusted?.images?.originals ?? page.image?.images?.originals);
    if (item) items.push(item);
  }
  for (const slot of d.carousel_data?.carousel_slots ?? []) {
    const item = pinImage(slot.images?.orig ?? slot.images?.["736x"]);
    if (item) items.push(item);
  }
  if (!items.length) {
    const img = pinImage(d.images?.orig);
    if (img) items.push(img);
  }
  const title = String(d.title || d.grid_title || d.description || "").split("\n")[0].trim();
  return { title: title || "Pinterest", items };
}

/* ---------- Halaman lain: Open Graph ---------- */

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

function metaTags(html: string) {
  const out: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attr = (n: string) => tag.match(new RegExp(`\\b${n}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
    const k = attr("property") ?? attr("name");
    const v = attr("content");
    const key = (k?.[2] ?? k?.[3])?.toLowerCase();
    if (key && v && !(key in out)) out[key] = decode(v[2] ?? v[3]);
  }
  return out;
}

async function openGraph(url: string): Promise<LinkResult> {
  const { text, type, url: final } = await getText(url, PREVIEW_UA);
  // Link langsung ke file foto atau video.
  const mime = type.split(";")[0].trim().toLowerCase();
  if (IMAGE_MIME.includes(mime) || VIDEO_MIME.includes(mime)) {
    return { title: decodeURIComponent(final.pathname.split("/").pop() ?? "").replace(/\.[^.]+$/, "") || final.hostname, items: [{ url: final.toString(), kind: mime.startsWith("video") ? "video" : "image" }] };
  }
  const m = metaTags(text);
  const abs = (v?: string) => {
    try {
      return v ? new URL(v, final).toString() : undefined;
    } catch {
      return undefined;
    }
  };
  const num = (v?: string) => (Number(v) > 0 ? Number(v) : undefined);
  const items: LinkItem[] = [];
  const video = abs(m["og:video:secure_url"] ?? m["og:video:url"] ?? m["og:video"]);
  const videoType = m["og:video:type"] ?? "";
  if (video && (VIDEO_MIME.includes(videoType) || /\.(mp4|webm)(\?|$)/i.test(video)))
    items.push({ url: video, kind: "video", w: num(m["og:video:width"]), h: num(m["og:video:height"]) });
  const image = abs(m["og:image:secure_url"] ?? m["og:image:url"] ?? m["og:image"] ?? m["twitter:image"] ?? m["twitter:image:src"]);
  if (!items.length && image) items.push({ url: image, kind: "image", w: num(m["og:image:width"]), h: num(m["og:image:height"]) });
  const title = m["og:title"] ?? m["twitter:title"] ?? decode(text.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim() ?? "");
  return { title: title || final.hostname, items };
}

/* ---------- Pintu masuk ---------- */

function route(u: URL) {
  const host = u.hostname.replace(/^www\./, "");
  if (/(^|\.)instagram\.com$/.test(host)) {
    const code = u.pathname.match(/^\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/)?.[1];
    if (code) return () => instagram(code);
  }
  if (/(^|\.)pinterest\.[a-z.]+$/.test(host)) {
    const id = u.pathname.match(/^\/pin\/(?:[^/]*--?)?(\d+)/)?.[1];
    if (id) return () => pinterest(id);
  }
  return null;
}

/** Cari foto dan video di sebuah link. Link pendek (pin.it, dll.) diikuti dulu ke alamat aslinya. */
export async function resolveLink(raw: string): Promise<LinkResult> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new LinkError("Itu bukan link. Salin alamat lengkap yang diawali https://.");
  }
  let run = route(u);
  if (!run && u.hostname === "pin.it") {
    const { res, url } = await safeFetch(u.toString(), { headers: { "User-Agent": PREVIEW_UA } });
    await res.body?.cancel();
    run = route(url);
    if (!run) throw new LinkError("Pin tidak ditemukan. Periksa lagi link pin.it-nya.");
  }
  const r = run ? await run() : await openGraph(u.toString());
  r.items = r.items.slice(0, MAX_ITEMS);
  if (!r.items.length) throw new LinkError("Tidak ada foto atau video yang bisa diambil dari link ini.");
  r.title = r.title.replace(/\s+/g, " ").slice(0, 120);
  return r;
}
