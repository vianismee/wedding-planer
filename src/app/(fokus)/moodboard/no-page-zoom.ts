"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Selama kanvas terbuka, zoom browser dimatikan supaya yang membesar hanya kanvas, bukan seluruh halaman:
 * - Ctrl/⌘ + scroll, dan cubit trackpad di Chrome, Edge, Firefox (dikirim sebagai wheel dengan ctrlKey).
 *   onWheel React terpasang passive, jadi preventDefault harus lewat listener sendiri.
 * - Cubit trackpad di Safari Mac dan cubit di iPad (gesturestart/gesturechange).
 * - Ctrl/⌘ dengan + - 0.
 * Gestur Safari dan tombol keyboard diteruskan ke kanvas lewat `zoomBy(faktor, clientX, clientY)`;
 * faktor null berarti kembali ke 100%. Ctrl + scroll sudah ditangani onWheel kanvas sendiri.
 */
export function useNoPageZoom(canvas: RefObject<HTMLElement | null>, zoomBy: (factor: number | null, clientX: number, clientY: number) => void) {
  const zoomRef = useRef(zoomBy);
  useEffect(() => {
    zoomRef.current = zoomBy;
  });

  useEffect(() => {
    const onCanvas = (t: EventTarget | null) => t instanceof Node && !!canvas.current?.contains(t);
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    // Cubit dengan jari (iPad) sudah ditangani kanvas lewat pointer event; gestur hanya dipakai untuk trackpad Safari.
    let fingers = 0;
    const touch = (e: TouchEvent) => {
      fingers = e.touches.length;
    };
    let last = 1;
    const gestureStart = (e: Event) => {
      e.preventDefault();
      last = 1;
    };
    const gestureChange = (e: Event) => {
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number; clientY: number };
      if (fingers || !onCanvas(e.target)) return;
      zoomRef.current(g.scale / last, g.clientX, g.clientY);
      last = g.scale;
    };
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !["=", "+", "-", "_", "0"].includes(e.key)) return;
      e.preventDefault();
      const r = canvas.current?.getBoundingClientRect();
      if (!r) return;
      zoomRef.current(e.key === "0" ? null : e.key === "-" || e.key === "_" ? 1 / 1.1 : 1.1, r.left + r.width / 2, r.top + r.height / 2);
    };
    const opt = { passive: false } as const;
    window.addEventListener("wheel", wheel, opt);
    window.addEventListener("keydown", key);
    document.addEventListener("touchstart", touch, { passive: true });
    document.addEventListener("touchend", touch, { passive: true });
    document.addEventListener("touchcancel", touch, { passive: true });
    document.addEventListener("gesturestart", gestureStart, opt);
    document.addEventListener("gesturechange", gestureChange, opt);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", key);
      document.removeEventListener("touchstart", touch);
      document.removeEventListener("touchend", touch);
      document.removeEventListener("touchcancel", touch);
      document.removeEventListener("gesturestart", gestureStart);
      document.removeEventListener("gesturechange", gestureChange);
    };
  }, [canvas]);
}
