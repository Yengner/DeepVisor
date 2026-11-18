import { describe, expect, it } from 'vitest';
import { parseWhatsAppWebhook, profileName } from './whatsapp';

const delivery = (field: string, value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '102290129340398', changes: [{ field, value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' }, ...value } }] }],
});

describe('parseWhatsAppWebhook', () => {
  it('reads a customer message that came from a Click-to-WhatsApp ad, without its text', () => {
    const body = delivery('messages', {
      contacts: [{ profile: { name: 'Ana\nLópez' }, wa_id: '16505551234' }],
      messages: [{
        from: '16505551234', id: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=', timestamp: '1763460000', type: 'text',
        text: { body: 'Hi, do you have Saturday openings?' },
        referral: { source_url: 'https://fb.me/abc', source_id: '120214567890123', source_type: 'ad', headline: 'Book now', ctwa_clid: 'ARAkLkA8rmlFeiCktEJQ' },
      }],
    });
    const parsed = parseWhatsAppWebhook(body);
    expect(parsed).toEqual([{
      phoneNumberId: '106540352242922', messageId: 'wamid.HBgLMTY1MDM4Nzk0MzkVAgASGBQzQTRBNjU5OUFFRTAzODEwMTQ0RgA=', direction: 'in',
      customerWaId: '16505551234', customerName: 'Ana López', sentAt: '2025-11-18T10:00:00.000Z',
      ad: { id: '120214567890123', clickId: 'ARAkLkA8rmlFeiCktEJQ' },
    }]);
    expect(JSON.stringify(parsed)).not.toContain('Saturday');
  });

  it('keeps an ad without a click id (Status ads) and treats post referrals and plain chats as not from an ad', () => {
    const body = delivery('messages', {
      messages: [
        { from: '1', id: 'a', timestamp: '1763460000', type: 'text', referral: { source_type: 'ad', source_id: '555' } },
        { from: '2', id: 'b', timestamp: '1763460000', type: 'text', referral: { source_type: 'post', source_id: '777' } },
        { from: '3', id: 'c', timestamp: '1763460000', type: 'image' },
      ],
    });
    expect(parseWhatsAppWebhook(body)?.map(m => m.ad)).toEqual([{ id: '555', clickId: null }, null, null]);
  });

  it('reads the owner\'s replies from the WhatsApp Business app', () => {
    const body = delivery('smb_message_echoes', {
      message_echoes: [{ from: '15550783881', to: '16505551234', id: 'wamid.echo1', timestamp: '1763460600', type: 'text', text: { body: 'Yes! 2pm?' } }],
    });
    expect(parseWhatsAppWebhook(body)).toEqual([{
      phoneNumberId: '106540352242922', messageId: 'wamid.echo1', direction: 'out', customerWaId: '16505551234', customerName: null, sentAt: '2025-11-18T10:10:00.000Z', ad: null,
    }]);
  });

  it('ignores delivery statuses, chat-opened events, other fields and malformed items', () => {
    const statuses = delivery('messages', { statuses: [{ id: 'wamid.x', status: 'read', timestamp: '1763460000', recipient_id: '1' }] });
    expect(parseWhatsAppWebhook(statuses)).toEqual([]);
    const welcome = delivery('messages', { messages: [{ from: '1', id: 'w', timestamp: '1763460000', type: 'request_welcome' }] });
    expect(parseWhatsAppWebhook(welcome)).toEqual([]);
    expect(parseWhatsAppWebhook(delivery('message_template_status_update', { event: 'APPROVED' }))).toEqual([]);
    const bad = delivery('messages', { messages: [{ from: 'abc', id: 'x', timestamp: '1' }, { from: '1', id: '', timestamp: '1763460000' }, { from: '1', id: 'ok', timestamp: 'soon' }] });
    expect(parseWhatsAppWebhook(bad)).toEqual([]);
    const noNumber = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { messages: [{ from: '1', id: 'a', timestamp: '1763460000' }] } }] }] };
    expect(parseWhatsAppWebhook(noNumber)).toEqual([]);
  });

  it('returns null for other webhook objects', () => {
    expect(parseWhatsAppWebhook({ object: 'ad_account', entry: [] })).toBeNull();
    expect(parseWhatsAppWebhook(null)).toBeNull();
  });

  it('bounds profile names', () => {
    expect(profileName('  ')).toBeNull();
    expect(profileName('x'.repeat(200))).toHaveLength(80);
  });
});
