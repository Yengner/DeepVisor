import type { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";
import "./public.css";

export const metadata: Metadata = {
  title: "DeepVisor - Easier Paid Ads for Salons",
  description:
    "DeepVisor makes running salon paid ads easier with Meta ad monitoring, wasted-spend detection, Scheduled Reviews, clear reports, campaign reviews, and simpler next-step approvals.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dv-public-shell">
      <Header />
      <main className="dv-public-main">{children}</main>
      <Footer />
    </div>
  );
}
