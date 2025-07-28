interface RawAd {
    id: number;
    name: string;
}

interface RawAdSet {
    id: number;
    name: string;
    ads_metrics: RawAd[];
}

interface RawCampaign {
    id: number;
    name: string;
    adset_metrics: RawAdSet[];
}

type RawData = RawCampaign[];

interface UnifiedWrapper {
    id: string;
    name: string;
    campaigns: RawCampaign[];
}
