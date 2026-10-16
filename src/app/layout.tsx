import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { ConfirmProvider } from "@/components/confirm";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Rukun", template: "%s | Rukun" },
  description: "Ruang kerja bersama untuk pasangan dan keluarga yang mengurus pernikahan sendiri.",
  applicationName: "Rukun",
  appleWebApp: { capable: true, title: "Rukun", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1C1B29",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh antialiased">
        <ConfirmProvider>{children}</ConfirmProvider>
        <SwRegister />
      </body>
    </html>
  );
}
