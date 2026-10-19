import { Caveat, Cormorant_Garamond, Dancing_Script, Great_Vibes, Playfair_Display } from "next/font/google";

// Font teks kanvas moodboard (lihat MOOD_FONTS). Hanya dipasang di halaman moodboard dan link vendor,
// supaya halaman lain tidak ikut mengunduhnya.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-cormorant", display: "swap" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-caveat", display: "swap" });
const dancing = Dancing_Script({ subsets: ["latin"], variable: "--font-dancing", display: "swap" });
const vibes = Great_Vibes({ subsets: ["latin"], weight: "400", variable: "--font-vibes", display: "swap" });

export const moodFontVars = [playfair, cormorant, caveat, dancing, vibes].map((f) => f.variable).join(" ");
