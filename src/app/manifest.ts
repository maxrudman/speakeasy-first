import type { MetadataRoute } from "next";

/** Makes Speak Ready installable ("Add to Home Screen" / "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Speak Ready",
    short_name: "Speak Ready",
    description: "Build your vocabulary and practice speaking answers out loud.",
    id: "/",
    start_url: "/vocabulary",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3f5f7",
    theme_color: "#2e6b57",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Practice", url: "/practice" },
      { name: "Journal", url: "/journal" },
    ],
  };
}
