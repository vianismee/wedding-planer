import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rukun, perencana pernikahan",
    short_name: "Rukun",
    description: "Ruang kerja bersama untuk pasangan dan keluarga yang mengurus pernikahan.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F2F1F6",
    theme_color: "#1C1B29",
    lang: "id",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
