import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TREDIT",
  description: "Barter branded goods, C2C platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}