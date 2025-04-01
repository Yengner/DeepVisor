import Header from "@/components/public/Header";
import React from "react";
import { Toaster } from "react-hot-toast";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {


  return (
        <div className="bg-white grid min-h-screen w-screen dark:bg-boxdark-2 dark:text-bodydark md:place-items-center">
          <Header />
          {children}
          <Toaster />
        </div>
  );
}
