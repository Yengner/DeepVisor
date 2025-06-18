import type { Metadata } from "next";
import "../../styles/globals.css";
import { Source_Sans_3, Manrope } from "next/font/google";
import Header from "@/components/public/Header";
import Footer from "@/components/public/Footer";
import Script from "next/script";


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
    <>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KPR97KV2"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        {/* End Google Tag Manager (noscript) */}

        {/* Google Tag Manager Script */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            (function(w,d,s,l,i){
              w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],
                  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
              f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-KPR97KV2');
          `,
          }}
        />
        {/* End Google Tag Manager Script */}

        {/* Google Analytics gtag.js */}
        <Script
          id="google-analytics-script"
          src="https://www.googletagmanager.com/gtag/js?id=G-GHTP28EVC0"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics-config"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-GHTP28EVC0');
          `,
          }}
        />
        {/* End Google Analytics gtag.js */}

        <Header />
        <main className="pt-20 md:pt-24">{children}</main>
        <Footer />
      </>
  );
}
