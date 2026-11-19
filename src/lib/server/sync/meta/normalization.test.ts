import {expect,it} from 'vitest';
import {actionMetric,deliveryMetrics,requiredMetric,optionalMetric,metricRatio} from './normalization';
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
it('reads a zero-spend day without impressions or clicks as zero delivery, keeping its conversations', () => {
 // Meta's real shape when ads are off but chats from earlier clicks are still attributed to the day.
 const row = { spend: '0', actions: [{ action_type: 'onsite_conversion.messaging_conversation_started_7d', value: '1' }] };
 expect(deliveryMetrics(row)).toEqual({ spend: 0, impressions: 0, clicks: 0 });
 expect(actionMetric(row.actions, ['onsite_conversion.messaging_conversation_started_7d'])).toBe(1);
 expect(deliveryMetrics({ spend: '0', impressions: '12', clicks: '1' })).toEqual({ spend: 0, impressions: 12, clicks: 1 });
});
it('still fails when spend is missing, or a day that spent lacks impressions or clicks', () => {
 expect(() => deliveryMetrics({ impressions: '10', clicks: '1' })).toThrow('Required Meta delivery metric unavailable');
 expect(() => deliveryMetrics({ spend: '4.20', clicks: '1' })).toThrow('Required Meta delivery metric unavailable');
 expect(() => deliveryMetrics({ spend: '4.20', impressions: '100' })).toThrow('Required Meta delivery metric unavailable');
 expect(() => deliveryMetrics({ spend: '0', impressions: 'bad' })).toThrow('Invalid Meta metric');
});
