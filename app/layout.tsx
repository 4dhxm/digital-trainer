import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HBE-LogicCircuit-Digital Trainer",
  description: "A skeuomorphic interactive clone of the Hanback Electronics digital logic trainer."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
