import Header from "../(public)/components/Header";
import Footer from "../(public)/components/Footer";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {


  return (
    <>
      <Header />
      <main className="bg-gray-50">{children}</main>
      <Footer />
    </>
  );
}
