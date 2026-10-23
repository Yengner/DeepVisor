import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { expect, it, vi } from 'vitest';
vi.mock('./exploration/AdvertisingExplorer', () => ({ MediaImage: () => null }));
import AdsTable from './AdsTable';

it('distinguishes missing ad observations from recorded zero results on desktop and mobile', () => {
  const render = (metricsAvailable: boolean) => renderToStaticMarkup(createElement(MantineProvider, null,
    createElement(AdsTable, {
      ads: [{ id: 'ad', ad_id: 'ad', name: 'Fixture', status: 'PAUSED', spend: '0',
        leads: 0, messages: 0, calls: 0, impressions: 0, clicks: 0, reach: null,
        creative_id: null, adset_id: 'set', adset_name: 'Set', campaign_id: 'campaign',
        campaign_name: 'Campaign', link_clicks: 0, cpm: null, ctr: null, cpc: null,
        cpl: null, frequency: null, start_date: '', end_date: '', platform_name: 'meta',
        raw_data: null, ad_format: null,
        metricsAvailable }], currencyCode: 'USD', onSelectAd: () => {},
    })));
  const missing = render(false), observed = render(true);
  expect(missing).toContain('Unavailable');
  expect(missing).not.toContain('0 Results');
  expect(missing).not.toContain('$0.00');
  expect(observed).toContain('0 Results');
  expect(observed).toContain('$0.00');
});
