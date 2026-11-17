import type { Metadata } from "next";
import Header from "./components/Header";
import Footer from "./components/Footer";
import "./public.css";

export const metadata: Metadata = {
  title: "DeepVisor: advertising, made simpler",
  description:
    "DeepVisor makes digital advertising simpler for every business. Start with your Meta ads today, free during beta.",
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dv-public-shell">
      <a href="#main" className="dv-skip-link">Skip to main content</a>
      <Header />
      <main id="main" tabIndex={-1} className="dv-public-main">{children}</main>
      <Footer />
    </div>
  );
}
