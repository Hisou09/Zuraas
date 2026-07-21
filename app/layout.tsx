import type { Metadata } from "next";
import "./globals.css";

export function generateMetadata(): Metadata {
  const title = "Нүүр";
  const description = "Монгол хадмалтай анимэ үзэж, манхва унших шинэ орон зай.";

  return {
    title,
    description,
    icons: { icon: "/logo-transparent.png", shortcut: "/logo-transparent.png" },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="mn"><body>{children}</body></html>;
}
