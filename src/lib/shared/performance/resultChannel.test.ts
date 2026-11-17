import { describe, expect, it } from 'vitest';
import { messagingApps, resultChannel, resultDefinition, type ResultRow } from './resultChannel';

const row = (destinationType: string | null, counts: Partial<Omit<ResultRow, 'destinationType'>> = {}): ResultRow => ({
  destinationType, spend: 10, leads: 0, messages: 3, calls: 0, ...counts,
});

describe('resultChannel', () => {
  it('maps Meta destination types', () => {
    expect(resultChannel('WHATSAPP')).toBe('whatsapp');
    expect(resultChannel(' whatsapp ')).toBe('whatsapp');
    expect(resultChannel('MESSENGER')).toBe('messaging');
    expect(resultChannel('INSTAGRAM_DIRECT')).toBe('messaging');
    expect(resultChannel('MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP')).toBe('messaging');
    expect(resultChannel('ON_AD')).toBe('instant_form');
    expect(resultChannel('PHONE_CALL')).toBe('calls');
    expect(resultChannel('WEBSITE')).toBe('website');
    expect(resultChannel(null)).toBe('unknown');
    expect(resultChannel('UNDEFINED')).toBe('unknown');
  });

  it('lists messaging apps in display order', () => {
    expect(messagingApps('MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP')).toEqual(['whatsapp', 'instagram', 'messenger']);
    expect(messagingApps('WHATSAPP')).toEqual(['whatsapp']);
    expect(messagingApps('WEBSITE')).toEqual([]);
  });
});

describe('resultDefinition', () => {
  it('names WhatsApp conversations when every active row is a WhatsApp ad set', () => {
    expect(resultDefinition([row('WHATSAPP'), row('WHATSAPP', { messages: 0 })])).toEqual({ kind: 'whatsapp_conversations', apps: ['whatsapp'] });
  });

  it('names mixed messaging as conversations and lists the apps', () => {
    const definition = resultDefinition([row('WHATSAPP'), row('MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP')]);
    expect(definition).toEqual({ kind: 'conversations', apps: ['whatsapp', 'instagram', 'messenger'] });
  });

  it('keeps Results when another channel spent money, even with zero results', () => {
    // Cost per conversation would otherwise include the website ad set's spend.
    expect(resultDefinition([row('WHATSAPP'), row('WEBSITE', { messages: 0 })]).kind).toBe('results');
  });

  it('ignores fully idle rows', () => {
    expect(resultDefinition([row('WHATSAPP'), row('WEBSITE', { spend: 0, messages: 0 })]).kind).toBe('whatsapp_conversations');
  });

  it('keeps Results when a WhatsApp ad set also reports leads or calls', () => {
    expect(resultDefinition([row('WHATSAPP', { leads: 1 })]).kind).toBe('results');
    expect(resultDefinition([row('WHATSAPP', { calls: 2 })]).kind).toBe('results');
  });

  it('treats unknown counts and destinations as not provable', () => {
    expect(resultDefinition([row('WHATSAPP', { leads: null })]).kind).toBe('results');
    expect(resultDefinition([row(null)]).kind).toBe('results');
    expect(resultDefinition([row('WHATSAPP', { spend: null, messages: 0 })]).kind).toBe('whatsapp_conversations');
  });

  it('names leads and calls only when they are the only result', () => {
    expect(resultDefinition([row('ON_AD', { leads: 4, messages: 0 })]).kind).toBe('leads');
    expect(resultDefinition([row('ON_AD', { leads: 4, messages: 1 })]).kind).toBe('results');
    expect(resultDefinition([row('PHONE_CALL', { calls: 2, messages: 0 })]).kind).toBe('calls');
  });

  it('falls back to Results with no rows', () => {
    expect(resultDefinition([])).toEqual({ kind: 'results', apps: [] });
  });
});
