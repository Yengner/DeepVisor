// src/app/reports/page.tsx
import ReportsClient from "@/components/reports/MainReportsPage";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import React from "react";

export default async function ReportsPage() {
  const loggedIn = await getLoggedInUser();
  const userId = loggedIn?.id;

  return (
    <ReportsClient />
  );
};

