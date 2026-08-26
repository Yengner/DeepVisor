import 'server-only';

export const MAX_DAILY_CAMPAIGN_BUDGET = 10_000;
export const MAX_LIFETIME_CAMPAIGN_BUDGET = 250_000;

export function getMonthlyBudgetUpperBound(value: string | null | undefined): number | null {
  switch (value) {
    case 'not_running_ads_yet':
    case '100_300':
      return 300;
    case '300_500':
      return 500;
    case 'under_1000':
    case '500_1000':
      return 1_000;
    case '1000_2500':
      return 2_500;
    case '1000_5000':
    case '2500_5000':
      return 5_000;
    case '5000_10000':
      return 10_000;
    case '5000_plus':
      return 25_000;
    case '10000_50000':
    case 'over_50000':
      return 50_000;
    default:
      return null;
  }
}
