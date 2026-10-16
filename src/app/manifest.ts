import type { MetadataRoute } from "next";

// Manifest WebApp: bisa dipasang ke layar utama HP dan desktop.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rukun, perencana pernikahan",
    short_name: "Rukun",
    description: "Ruang kerja bersama untuk pasangan dan keluarga yang mengurus pernikahan.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2F1F6",
    theme_color: "#1C1B29",
    lang: "id",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Jadwal", url: "/jadwal", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Daftar tamu", url: "/tamu", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Budget", url: "/budget", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Checklist", url: "/checklist", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
