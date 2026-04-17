import type { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";


export const metadata: Metadata = {
  title: "DeepVisor - Lead Intelligence for Service Businesses",
  description:
    "DeepVisor helps service businesses turn ad account history into more qualified leads, clearer quote decisions, queued next steps, and less hands-on digital marketing work.",
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
