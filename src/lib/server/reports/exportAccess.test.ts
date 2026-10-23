import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ReportScopeError } from './access';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), context: vi.fn(), payload: vi.fn() }));
vi.mock('@/lib/server/supabase/server', () => ({ createSupabaseClient: async () => ({ auth: { getUser: mocks.auth } }) }));
vi.mock('@/lib/server/actions/business/context', () => ({ getOrCreateOrganizationBusinessContext: mocks.context }));
vi.mock('./request', () => ({ resolveReportRequest: async () => ({}) }));
vi.mock('./demo', () => ({ buildDemoReportPayload: mocks.payload }));
vi.mock('./csv', () => ({ renderReportCsv: () => 'csv' }));
vi.mock('@/lib/server/repositories/reports/buildReportPayload', () => ({ buildReportPayload: mocks.payload }));
vi.mock('./pdf/renderReportPdf', () => ({ renderReportPdfBuffer: mocks.payload }));
import { GET as csv } from '@/app/api/reports/csv/route';
import { GET as pdf } from '@/app/api/reports/pdf/route';

describe.each([['CSV', csv], ['PDF', pdf]] as const)('%s export authorization', (_, handler) => {
  it('rejects a missing session before loading a business or report', async () => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ data: { user: null }, error: null });
    expect((await handler(new NextRequest('http://localhost/api/reports/export'))).status).toBe(401);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.payload).not.toHaveBeenCalled();
  });
  it.each([true, false])('sanitizes denied scopes and internal failures (%s)', async denied => {
    mocks.auth.mockResolvedValue({ data: { user: { id: 'user' } }, error: null });
    mocks.context.mockResolvedValue({ businessId: 'business', organizationName: 'Business' });
    mocks.payload.mockRejectedValue(denied ? new ReportScopeError('private-account') : new Error('database-secret'));
    const result = await handler(new NextRequest('http://localhost/api/reports/export'));
    expect(result.status).toBe(denied ? 403 : 500);
    const body = await result.text();
    expect(body).not.toContain('private-account');
    expect(body).not.toContain('database-secret');
  });
});
