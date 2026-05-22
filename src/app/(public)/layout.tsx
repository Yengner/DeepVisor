import type { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";


export const metadata: Metadata = {
  title: "DeepVisor - Easier Paid Ads for Salons",
  description:
    "DeepVisor makes running salon paid ads easier with Meta ad monitoring, wasted-spend detection, calendar queues, clear reports, campaign reviews, and simpler next-step approvals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
