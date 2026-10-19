import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const captured = vi.hoisted(() => ({ adsets: [] as Array<{id:string;delivery?:boolean}>, ads: [] as Array<{id:string;delivery?:boolean}> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace:vi.fn() }), usePathname:()=>'/campaigns', useSearchParams:()=>new URLSearchParams() }));
vi.mock('@/lib/server/data/queries/components.query', () => ({ fetchAdSetsForCampaign:vi.fn(), fetchAdsForAdset:vi.fn() }));
vi.mock('@/lib/shared', () => ({ formatCurrencyAmount:(value:number)=>String(value), formatRetryDelay:()=>'' }));
vi.mock('./RunAgainSheet', () => ({default:()=>null}));
vi.mock('./CampaignTable', () => ({default:()=>null}));
vi.mock('./AdSetTable', () => ({default:({adSets}:{adSets:typeof captured.adsets})=>{captured.adsets=adSets;return null;}}));
vi.mock('./AdsTable', () => ({default:({ads}:{ads:typeof captured.ads})=>{captured.ads=ads;return null;}}));
import CampaignDashboard from './CampaignDashboard';
import { activeDeliveryKeys } from '@/lib/server/campaigns/exploration/delivery';
type Props = ComponentProps<typeof CampaignDashboard>;
function render(tab:'adsets'|'ads', pausedParent=false) {
  const hierarchy = [
    {external_id:'campaign',parent_external_id:null,entity_level:'campaign',status:pausedParent?'PAUSED':'ACTIVE'},
    {external_id:'empty-set',parent_external_id:'campaign',entity_level:'adset',status:'ACTIVE'},
    {external_id:'live-set',parent_external_id:'campaign',entity_level:'adset',status:'ACTIVE'},
    {external_id:'paused-ad',parent_external_id:'live-set',entity_level:'ad',status:'PAUSED'},
    {external_id:'live-ad',parent_external_id:'live-set',entity_level:'ad',status:'ACTIVE'},
  ];
  const props:Props={
    campaigns:[{id:'campaign',name:'Campaign',status:'ACTIVE'}] as Props['campaigns'],
    deliveryState:{activeKeys:activeDeliveryKeys(hierarchy),available:true},
    platform:{id:'integration',name:'meta'},adAccountId:'account',currencyCode:'USD',
    accountMetrics:{spend:0,impressions:0,clicks:0,link_clicks:0,reach:0,leads:0,messages:0,ctr:0,cpc:0,cpm:0},
    initialSelection:{tab,campaignId:'campaign',adsetId:'live-set'},
    initialAdSets:[{id:'empty-set',status:'ACTIVE',name:'No active ads'},{id:'live-set',status:'ACTIVE',name:'Active child'}] as Props['initialAdSets'],
    initialAds:[{id:'paused-ad',ad_id:'paused-ad',status:'PAUSED'},{id:'live-ad',ad_id:'live-ad',status:'ACTIVE'}] as Props['initialAds'],
  };
  renderToStaticMarkup(createElement(MantineProvider,null,createElement(CampaignDashboard,props)));
}
describe('nested campaign tab delivery wiring',()=>{
  beforeEach(()=>{captured.adsets=[];captured.ads=[];});
  it('passes sorted delivery flags to the ad-set table, excluding an ACTIVE set with no ads',()=>{
    render('adsets');
    expect(captured.adsets.map(({id,delivery})=>({id,delivery}))).toEqual([
      {id:'live-set',delivery:true},{id:'empty-set',delivery:false},
    ]);
  });
  it('passes sorted delivery flags to the ads table without highlighting paused siblings',()=>{
    render('ads');
    expect(captured.ads.map(({id,delivery})=>({id,delivery}))).toEqual([
      {id:'live-ad',delivery:true},{id:'paused-ad',delivery:false},
    ]);
  });
  it.each(['adsets','ads'] as const)('withholds all %s highlights under a paused campaign',tab=>{
    render(tab,true);
    const rows=tab==='adsets'?captured.adsets:captured.ads;
    expect(rows).toHaveLength(2);
    expect(rows.every(row=>row.delivery===false)).toBe(true);
  });
});
