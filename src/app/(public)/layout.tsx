import { getTranslations } from "next-intl/server";
import Header from "./components/Header";
import Footer from "./components/Footer";
import "./public.css";

export async function generateMetadata() {
  const t = await getTranslations("public.meta");
  return { title: t("title"), description: t("description") };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("public.nav");
  return (
    <div className="dv-public-shell">
      <a href="#main" className="dv-skip-link">{t("skip")}</a>
      <Header />
      <main id="main" tabIndex={-1} className="dv-public-main">{children}</main>
      <Footer />
    </div>
  );
}
