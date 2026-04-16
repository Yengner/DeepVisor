import type { Metadata } from "next";
import "@mantine/core/styles.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { Manrope, Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import PendingAuthToast from "@/components/ui/toasts/PendingAuthToast";
import MetaFirstSyncTracker from "@/components/integrations/MetaFirstSyncTracker";
import "../globals.css";

const bodyFont = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const displayFont = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "DeepVisor - Empower Your Business with Advanced Ad Insights",
  description: "Helping businesses grow with advanced ad tools and insights.",
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <MantineProvider>
          <Toaster />
          <PendingAuthToast />
          <MetaFirstSyncTracker />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
};
