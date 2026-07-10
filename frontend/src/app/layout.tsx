import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Platform — Local AI Agents",
  description: "Autonomous local AI agents platform powered by Ollama",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body>{children}</body>
    </html>
  );
}
