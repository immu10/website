import {
  Geist,
  Geist_Mono,
  Permanent_Marker,
  Caveat,
  Comic_Neue,
  Lora,
} from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import CausticsCanvas from "./components/background/CausticsCanvas";
import BubbleField from "./components/background/BubbleField";
import DarkToggle from "./components/DarkToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headings (Permanent Marker) and descriptions (Caveat).
const permanentMarker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});
const caveat = Caveat({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-desc",
});
// Body text — bundled Comic Sans look-alike.
const comicNeue = Comic_Neue({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});
// Serif option (Century Schoolbook alternative).
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
});

export const metadata = {
  title: "immu10",
  description: "site about me:3",
  // Tells the Dark Reader extension to leave this site alone (we control the
  // colours ourselves), which avoids it overriding the background.
  other: { "darkreader-lock": "true" },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${permanentMarker.variable} ${caveat.variable} ${comicNeue.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Set dark mode before paint (defaults to dark) to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('dark');if(s===null||s==='1')document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />

        {/* Site-wide background: the "sub2" theme (noise water + dim bubbles). */}
        <CausticsCanvas variant="noise" />
        <BubbleField dim />

        {/*
          STASHED (kept, not used) — the old "Subnautica" look. To bring it back,
          replace the two lines above with:
            <CausticsCanvas variant="grid" />
            <BubbleField />
        */}

        {/* Darkening layer over the background (toggled by the Dark button). */}
        <div className="dark-overlay" />

        <DarkToggle />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
