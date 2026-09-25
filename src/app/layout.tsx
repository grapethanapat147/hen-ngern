import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Noto_Sans_Thai } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { PRODUCT_NAME, TAGLINE } from "@/lib/copy";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: TAGLINE,
};

export const viewport: Viewport = {
  themeColor: "#F7F2EA",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${beVietnam.variable} ${notoThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
