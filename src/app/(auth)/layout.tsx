import Header from "../(public)/components/Header";
import Footer from "../(public)/components/Footer";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main style={{ background: '#f4f7fc' }}>{children}</main>
      <Footer />
    </>
  );
}
