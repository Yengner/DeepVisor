export interface ConnectedAccount {
    platform: string;
    accountId: string;
    connectedAt: string;
}


export interface UserData {
    businessName: string;
    businessType: string;
    industry: string;
    monthlyBudget: string;
    website: string;
    description: string;
    adGoals: string[];
    preferredPlatforms: string[];
    emailNotifications: boolean;
    weeklyReports: boolean;
    performanceAlerts: boolean;
    connectedAccounts: ConnectedAccount[];
}