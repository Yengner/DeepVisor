import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const getUser = vi.hoisted(() => vi.fn());
vi.mock('../supabase/server', () => ({ createSupabaseClient: async () => ({ auth: { getUser } }) }));
vi.mock('../actions/business/context', () => ({ getOrCreateOrganizationBusinessContext: vi.fn() }));
vi.mock('../actions/app/selection', () => ({ resolveCurrentSelection: vi.fn() }));
vi.mock('../repositories/reports/buildReportPayload', () => ({ buildReportPayload: vi.fn() }));
vi.mock('./pdf/renderReportPdf', () => ({ renderReportPdfBuffer: vi.fn() }));
import { getOrCreateOrganizationBusinessContext } from '../actions/business/context';
import { resolveCurrentSelection } from '../actions/app/selection';
import { buildReportPayload } from '../repositories/reports/buildReportPayload';
import { renderReportPdfBuffer } from './pdf/renderReportPdf';
import { GET as csv } from '@/app/api/reports/csv/route';
import { GET as pdf } from '@/app/api/reports/pdf/route';
import { buildReportFixture } from '@/lib/shared/reports/fixtures';
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
  vi.mocked(getOrCreateOrganizationBusinessContext).mockResolvedValue({ businessId: 'authorized-business', organizationName: 'Example' } as Awaited<ReturnType<typeof getOrCreateOrganizationBusinessContext>>);
  vi.mocked(resolveCurrentSelection).mockResolvedValue({ selectedAdAccountId: 'authorized-account', selectedPlatformId: 'platform' });
  vi.mocked(buildReportPayload).mockResolvedValue(buildReportFixture());
  vi.mocked(renderReportPdfBuffer).mockResolvedValue({ buffer: Buffer.from('%PDF-fixture'), payload: buildReportFixture(), fileName: 'fixture-report.pdf' });
});
it('downloads complete private CSV using authenticated business and resolved account selection', async () => {
  const response = await csv(new NextRequest('https://example.test/api/reports/csv?businessId=attacker&date_from=2026-10-08&date_to=2026-10-14'));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toContain('attachment;');
  expect(response.headers.get('content-type')).toContain('text/csv');
  expect(buildReportPayload).toHaveBeenCalledWith(expect.objectContaining({ businessId: 'authorized-business', adAccountIds: ['authorized-account'], dateFrom: '2026-10-08', dateTo: '2026-10-14' }));
  const text = await response.text(); expect(text).toContain('snapshot'); expect(text).toContain('hourly'); expect(text).toContain('finding');
});
it('keeps demo CSV isolated from live reads and labels every row', async () => {
  const response = await csv(new NextRequest('https://example.test/api/reports/csv?demo=1&date_from=2026-10-08&date_to=2026-10-14'));
  expect(buildReportPayload).not.toHaveBeenCalled(); expect(resolveCurrentSelection).not.toHaveBeenCalled();
  expect(await response.text()).toContain(',demo,');
});
it('downloads PDF through the existing renderer with canonical scope and private caching', async () => {
  const response = await pdf(new NextRequest('https://example.test/api/reports/pdf?ad_account_id=account&campaign_id=campaign&date_from=2026-10-08&date_to=2026-10-14&demo=1'));
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('application/pdf');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(renderReportPdfBuffer).toHaveBeenCalledWith(expect.objectContaining({ demo: true, query: expect.objectContaining({ businessId: 'authorized-business', adAccountIds: ['account'], campaignIds: ['campaign'] }) }));
  expect(await response.text()).toBe('%PDF-fixture');
});
it.each([['CSV', csv], ['PDF', pdf]] as const)('requires authentication before reading %s data', async (_, get) => {
  getUser.mockResolvedValue({ data: { user: null }, error: new Error('Authentication required') });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await get(new NextRequest('https://example.test/api/reports/export'));
    expect(response.status).toBe(401);
    expect(getOrCreateOrganizationBusinessContext).not.toHaveBeenCalled(); expect(buildReportPayload).not.toHaveBeenCalled(); expect(renderReportPdfBuffer).not.toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
