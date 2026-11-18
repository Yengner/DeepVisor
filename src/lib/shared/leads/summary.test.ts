import { describe, expect, it } from 'vitest';
import { median, replyMinutes, summarizeLeads, type LeadFact } from './summary';

const lead = (over: Partial<LeadFact> = {}): LeadFact => ({
  channel: 'whatsapp', source: 'ad', adExternalId: '1', outcome: null,
  firstMessageAt: '2026-11-10T10:00:00Z', firstReplyAt: null, ...over,
});

describe('summarizeLeads', () => {
  it('counts leads per ad and costs a booked customer from that ad\'s spend', () => {
    const summary = summarizeLeads([
      lead({ outcome: 'booked' }), lead({ outcome: 'booked' }), lead({ outcome: 'not_booked' }), lead(),
      lead({ adExternalId: '2' }),
      lead({ source: 'organic', adExternalId: null, outcome: 'booked' }),
    ], [
      { externalId: '1', name: 'Weekend promo', spend: 60, metaConversations: 5 },
      { externalId: '2', name: 'Video', spend: 20, metaConversations: 1 },
      { externalId: '3', name: 'Paused', spend: 5, metaConversations: 0 },
    ]);
    expect(summary).toMatchObject({
      leads: 6, fromAds: 5, organic: 1, booked: 3, bookedFromAds: 2, notBooked: 1, unmarked: 2,
      receivedFromAds: 5, metaConversations: 6, spend: 80, costPerLead: 16, costPerBooked: 40,
    });
    expect(summary.ads.map(a => [a.externalId, a.leads, a.booked, a.costPerBooked])).toEqual([['1', 4, 2, 30], ['2', 1, 0, null]]);
  });

  it('never treats unmarked as not booked, and has no cost per booked until something is booked', () => {
    const summary = summarizeLeads([lead(), lead()], [{ externalId: '1', name: null, spend: 50, metaConversations: 2 }]);
    expect(summary).toMatchObject({ booked: 0, notBooked: 0, unmarked: 2, costPerBooked: null, costPerLead: 25 });
  });

  it('leaves spam out of the counts but reports it', () => {
    const summary = summarizeLeads([lead({ outcome: 'spam' }), lead()], [{ externalId: '1', name: null, spend: 10, metaConversations: 2 }]);
    expect(summary).toMatchObject({ leads: 1, fromAds: 1, spam: 1, receivedFromAds: 1 });
  });

  it('includes ads Meta says started conversations even if none reached the log', () => {
    const summary = summarizeLeads([], [{ externalId: '9', name: 'Missing', spend: 30, metaConversations: 3 }]);
    expect(summary).toMatchObject({ receivedFromAds: 0, metaConversations: 3, spend: 30, costPerLead: null });
  });

  it('counts call leads separately from WhatsApp in the Meta comparison', () => {
    const summary = summarizeLeads([lead({ channel: 'call', outcome: 'booked' }), lead()], [{ externalId: '1', name: null, spend: 40, metaConversations: 1 }]);
    expect(summary).toMatchObject({ calls: 1, fromAds: 2, receivedFromAds: 1, bookedFromAds: 1, costPerBooked: 40 });
  });

  it('reports the median minutes to first reply', () => {
    const summary = summarizeLeads([
      lead({ firstReplyAt: '2026-11-10T10:10:00Z' }), lead({ firstReplyAt: '2026-11-10T10:30:00Z' }), lead({ firstReplyAt: null }),
    ], []);
    expect(summary.medianReplyMinutes).toBe(20);
  });
});

describe('helpers', () => {
  it('median and reply minutes', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(replyMinutes({ firstMessageAt: '2026-11-10T10:00:00Z', firstReplyAt: '2026-11-10T09:00:00Z' })).toBeNull();
    expect(replyMinutes({ firstMessageAt: '2026-11-10T10:00:00Z', firstReplyAt: '2026-11-10T10:04:31Z' })).toBe(5);
  });
});
