import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CPS Clause Builder — Royal LePage Advance Realty",
  description: "Contract of Purchase and Sale clause selection tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
