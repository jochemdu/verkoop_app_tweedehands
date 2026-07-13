import type { Metadata } from "next";
import { Outfit, Work_Sans, Fira_Code } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code" });

export const metadata: Metadata = {
  title: "VerkoopAssistent",
  description: "Persoonlijke inventaris- en verkoopmanager",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${outfit.variable} ${workSans.variable} ${firaCode.variable}`}
    >
      <body>
        <NextIntlClientProvider>
          {children}
          <Toaster position="top-center" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
