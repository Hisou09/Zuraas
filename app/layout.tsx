import type { Metadata } from "next";
import "./globals.css";
import "./auth-local.css";
import "./button-system.css";
import "./polish.css";
import "./admin-polish.css";
import "./ui-system.css";
import { getLocalUser } from "./local-auth";
import { AccessGate } from "./components/AccessGate";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const title = "Зураас";
  const description = "Монгол хадмалтай хэнтаи үзэж, манхва унших шинэ орон зай.";

  return {
    title,
    description,
    icons: { icon: "/logo-transparent.png", shortcut: "/logo-transparent.png" },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user=await getLocalUser();
  return <html lang="mn"><body><AccessGate authenticated={Boolean(user)}>{user?children:null}</AccessGate></body></html>;
}
