import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildReportFixture } from '@/lib/shared/reports/fixtures';
import { TimeSection } from './TimeSection';

describe('hourly presentation boundaries', () => {
  it('withholds hourly cells and the exact-value table without a verified timezone', () => {
    const payload = buildReportFixture();
    payload.meta.timezone = null;
    const html = renderToStaticMarkup(createElement(TimeSection, { payload }));
    expect(html).toContain('A verified advertiser timezone is required.');
    expect(html).not.toContain('Inspect hourly data');
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('Thursday 9:00');
  });

  it('retains exact observed values and defaults mobile to a day with measurements', () => {
    const html = renderToStaticMarkup(createElement(TimeSection, { payload: buildReportFixture() }));
    expect(html).toContain('<option value="3" selected="">Thursday</option>');
    expect(html).toContain('Thursday 9:00, Clicks: 10, 1 observed dates');
    expect(html).toContain('Monday 0:00, Clicks: Unavailable, 0 observed dates');
    expect(html).toContain('Inspect hourly data');
  });
});
