import Footer from "@/components/public/Footer";
import Header from "@/components/public/Header";
import { Toaster } from "react-hot-toast";

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
