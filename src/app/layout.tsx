import type { Metadata } from "next";
import "@mantine/core/styles.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { Manrope, Sora } from "next/font/google";
import { Toaster } from "react-hot-toast";
import PendingAuthToast from "@/components/ui/toasts/PendingAuthToast";
import FirstSyncTracker from "@/components/integrations/FirstSyncTracker";
import { deepVisorTheme } from "@/theme";
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
  title: "DeepVisor — Advertising Intelligence",
  applicationName: "DeepVisor",
  icons: {
    icon: [
      { url: "/images/brand/deepvisor-app-icon-light-128.png", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/images/brand/deepvisor-app-icon-dark-128.png", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/apple-icon.png",
  },
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
        <MantineProvider theme={deepVisorTheme} defaultColorScheme="light">
          <Toaster />
          <PendingAuthToast />
          <FirstSyncTracker />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
};
