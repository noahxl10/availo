import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Availo Dashboard",
  description: "Operator dashboard shell for Availo",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
