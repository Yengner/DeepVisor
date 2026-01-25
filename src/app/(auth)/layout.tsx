
import { Toaster } from "react-hot-toast";
import Header from "../(public)/components/Header";
import Footer from "../(public)/components/Footer";

export default async function AuthenticatedLayout({ children }: Readonly<{ children: React.ReactNode }>) {


  return (
    <>
      <Header />
        <Toaster />
          <main className="pt-14 pb-14 md:pt-14 md:pb-14 bg-gray-50">{children}</main>
      <Footer />
    </>
  );
}
