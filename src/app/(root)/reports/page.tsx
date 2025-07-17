import ReportsClient from "@/components/reports/MainReportsPage";
import { getLoggedInUser } from "@/lib/actions/user.actions";


export default async function ReportsPage() {
  const loggedIn = await getLoggedInUser();

  return (
    <ReportsClient />
  );
};

