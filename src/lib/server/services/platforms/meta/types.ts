export interface AdAccountDetails {
  id: string;
  name: string;
  account_status: number;
  currency?: string | null;
  timezone_name?: string | null;
}
