import type { Metadata } from "next";
import "./globals.css";
import { getChatGPTUser } from "./chatgpt-auth";
import { AccessGate } from "./components/AccessGate";

export const dynamic = "force-dynamic";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user=await getChatGPTUser();
  return <html lang="mn"><body><AccessGate authenticated={Boolean(user)}>{user?children:null}</AccessGate></body></html>;
}
