import {expect,it} from 'vitest';
import {actionMetric,requiredMetric,optionalMetric,metricRatio} from './normalization';
import {aggregateDailyMetricsRows} from '../../repositories/ad_accounts/normalizers';
it('distinguishes zero, unavailable and malformed metrics',()=>{
 expect(requiredMetric('0')).toBe(0);expect(optionalMetric(undefined)).toBeNull();
 for(const value of [undefined,null,'','12junk',-1,Infinity])expect(()=>requiredMetric(value)).toThrow();
 expect(metricRatio(12,0)).toBeNull();expect(metricRatio(12,100,100)).toBe(12);
});
it('does not double count overlapping aliases or discard a valid explicit zero',()=>{
 expect(actionMetric([{action_type:'lead',value:'4'},{action_type:'pixel_lead',value:'4'}],['lead','pixel_lead'])).toBe(4);
 expect(actionMetric([{action_type:'lead',value:'0'},{action_type:'pixel_lead',value:'4'}],['lead','pixel_lead'])).toBe(0);
 expect(()=>actionMetric([{action_type:'lead',value:'bad'}],['lead'])).toThrow();
});
it('does not fabricate unique reach from overlapping daily observations',()=>{
 const day={currency_code:'USD',day:'2026-10-01',spend:20,impressions:100,clicks:5,reach:80,inline_link_clicks:4,leads:1,messages:0,calls:0};
 expect(aggregateDailyMetricsRows([day,{...day,day:'2026-10-02'}])).toMatchObject({spend:40,reach:null,ctr:5,cpc:4,cpm:200});
});
