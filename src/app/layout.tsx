import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "LaunchCopilot — grade your app's store listing, get a launch kit";
const description =
  "Paste your newly launched mobile app's store listing and get a graded ASO report (28 deterministic rules) plus a complete, validated AI launch kit in about a minute.";

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: "/icon.svg" },
  openGraph: {
    title,
    description,
    url: "https://launchcopilot-two.vercel.app",
    siteName: "LaunchCopilot",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "LaunchCopilot" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
