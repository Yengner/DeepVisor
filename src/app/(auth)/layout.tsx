import Header from "../(public)/components/Header";
import Footer from "../(public)/components/Footer";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main style={{ background: '#f4f5ef' }}>{children}</main>
      <Footer />
    </>
  );
}
