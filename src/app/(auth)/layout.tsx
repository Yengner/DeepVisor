import Footer from "@/components/public/Footer";
import Header from "@/components/public/Header";
import React from "react";
import { Toaster } from "react-hot-toast";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {


  return (
    <>
      <Header />
        <Toaster />
          <main className="pt-20 pb-20 md:pt-24 md:pb-24 bg-gray-50">{children}</main>
      <Footer />
    </>
  );
}
