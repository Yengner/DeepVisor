import type { Metadata } from "next";
import { Source_Sans_3, Manrope } from "next/font/google";
import '@mantine/core/styles.css';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "DeepVisor - Empower Your Business with Advanced Ad Insights",
  description: "Helping businesses grow with advanced ad tools and insights.",
};

const manrope = Manrope({ subsets: ['latin'] });
const sourceSans = Source_Sans_3({ subsets: ['latin'] });


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider>{children}</MantineProvider>
      </body>
    </html>
  );
};
