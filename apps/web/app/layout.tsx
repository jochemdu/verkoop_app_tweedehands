import type { Metadata } from "next";
import { Outfit, Work_Sans, Fira_Code } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });

export const metadata: Metadata = {
  title: "VerkoopAssistent",
  description: "Persoonlijke inventaris- en verkoopmanager",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="nl"
      className={`${outfit.variable} ${workSans.variable} ${firaCode.variable}`}
    >
      <body>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
