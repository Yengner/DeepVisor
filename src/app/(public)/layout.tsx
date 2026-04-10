import type { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";


export const metadata: Metadata = {
  title: "DeepVisor - Account Intelligence for Ad Accounts",
  description:
    "DeepVisor helps business owners understand ad account performance with clear dashboards, calendar queues, reports, and explainable recommendations.",
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
