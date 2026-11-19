import { describe, expect, it, vi } from 'vitest';
import type { WhatsAppMessage } from '@/lib/shared/webhooks/whatsapp';

vi.mock('server-only', () => ({}));
import { contactKey, ingestWhatsAppMessages, messageKey } from './ingest';

const msg = (over: Partial<WhatsAppMessage> = {}): WhatsAppMessage => ({
  phoneNumberId: '106540352242922', messageId: 'wamid.1', direction: 'in', customerWaId: '16505551234',
  customerName: 'Ana', sentAt: '2026-11-10T10:00:00.000Z', ad: { id: '777', clickId: 'clk' }, ...over,
});
function fakeClient(responses: unknown[]) {
  const calls: Record<string, unknown>[] = [];
  const client = { rpc: vi.fn(async (_name: string, args: Record<string, unknown>) => { calls.push(args); return { data: responses.shift(), error: null }; }) };
  return { client: client as never, calls };
}

describe('ingestWhatsAppMessages', () => {
  it('sends only hashes and the last 4 digits, never the full number', async () => {
    const { client, calls } = fakeClient([{ status: 'recorded', created: true }]);
    const result = await ingestWhatsAppMessages(client, [msg()], 'app-secret');
    expect(result).toMatchObject({ received: 1, recorded: 1, newLeads: 1 });
    expect(calls[0]).toMatchObject({
      p_phone_number_id: '106540352242922', p_direction: 'in', p_contact_last4: '1234', p_contact_name: 'Ana',
      p_ad_external_id: '777', p_ctwa_clid: 'clk', p_at: '2026-11-10T10:00:00.000Z',
      p_contact_key: contactKey('app-secret', '106540352242922', '16505551234'),
      p_message_key: messageKey('106540352242922', 'wamid.1'),
    });
    expect(JSON.stringify(calls)).not.toContain('16505551234');
  });

  it('keys the same customer the same way, and differently per secret or number', () => {
    const k = contactKey('s', '1', '16505551234');
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(contactKey('s', '1', '16505551234')).toBe(k);
    expect(contactKey('other', '1', '16505551234')).not.toBe(k);
    expect(contactKey('s', '2', '16505551234')).not.toBe(k);
  });

  it('records oldest first and the customer before a same-second reply', async () => {
    const { client, calls } = fakeClient([{ status: 'recorded', created: true }, { status: 'recorded' }, { status: 'recorded' }]);
    await ingestWhatsAppMessages(client, [
      msg({ messageId: 'c', sentAt: '2026-11-10T10:05:00.000Z', ad: null }),
      msg({ messageId: 'b', direction: 'out', sentAt: '2026-11-10T10:00:00.000Z', ad: null, customerName: null }),
      msg({ messageId: 'a', sentAt: '2026-11-10T10:00:00.000Z' }),
    ], 's');
    expect(calls.map(c => c.p_message_key)).toEqual(['a', 'b', 'c'].map(id => messageKey('106540352242922', id)));
    expect(calls[1]).toMatchObject({ p_direction: 'out', p_contact_last4: null });
  });

  it('tallies duplicates, ignored replies and unknown numbers, and fails on anything else', async () => {
    const { client } = fakeClient([{ status: 'duplicate' }, { status: 'ignored' }, { status: 'unknown_number' }]);
    expect(await ingestWhatsAppMessages(client, [msg({ messageId: '1' }), msg({ messageId: '2' }), msg({ messageId: '3' })], 's'))
      .toMatchObject({ recorded: 0, duplicates: 1, ignored: 1, unknownNumbers: 1 });
    await expect(ingestWhatsAppMessages(fakeClient([{ status: 'weird' }]).client, [msg()], 's')).rejects.toThrow('Unexpected');
    await expect(ingestWhatsAppMessages(fakeClient([]).client, [msg()], undefined)).rejects.toThrow('META_APP_SECRET');
  });
});
