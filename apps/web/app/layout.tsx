import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "VerkoopAssistent",
  description: "Persoonlijke inventaris- en verkoopmanager",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
