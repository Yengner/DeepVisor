import BizSdk from 'facebook-nodejs-business-sdk';

const { FacebookAdsApi, AdAccount, Business, AdsPixel, LeadgenForm, Campaign, AdSet, AdCreative, Ad } = BizSdk;
// const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN!;
const ACCESS_TOKEN = "EAAQohtuZCRFoBO1DcBBLdPUvCbfYZB6RCUk4oViHZB3IYos9LUjBwdWQZB3gyHZCFoptzSXVbms008hLr0Cuuqv9GOnAOGSQnLAWTh8Qs54yfaXwVo9E7BSboqpYiAeG6vuwFr207ZC5kqx7SkJdwGSmrxKkg9FIiTqdTfK16KwJUtEvWfJhSP01vj47QM9sugPUYX9S1a1heXOHoX7WMRJu2kjp3sD52LHxZBKQdgl3zz7jpbqchZCpG6QsZCNNZB";
const APP_SECRET = process.env.META_APP_SECRET!;
const API_VERSION = 'v23.0';

// initialize once
FacebookAdsApi.init(ACCESS_TOKEN, APP_SECRET, API_VERSION);

export {
    AdAccount,
    Business,
    AdsPixel,
    LeadgenForm,
    Campaign,
    AdSet,
    AdCreative,
    Ad,
};
