import { describe, expect, it } from 'vitest';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import en from '../../messages/en.json';
import es from '../../messages/es.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? { ...all, [path]: value } : { ...all, ...flatten(value, path) };
  }, {});
}

/** Argument names and rich-text tags a message uses, so both languages pass the same values. */
function signature(message: string): string[] {
  const names = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) names.add(el.value);
      if (el.type === TYPE.plural || el.type === TYPE.select) {
        names.add(el.value);
        Object.values(el.options).forEach(o => walk(o.value));
      }
      if (el.type === TYPE.tag) {
        names.add(`<${el.value}>`);
        walk(el.children);
      }
    }
  };
  walk(parse(message));
  return [...names].sort();
}

const english = flatten(en as Tree);
const spanish = flatten(es as Tree);

describe('message catalogs', () => {
  it('have the same keys in English and Spanish', () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
  });

  it('use the same placeholders and tags in every message, and parse as ICU', () => {
    for (const key of Object.keys(english)) {
      expect({ key, args: signature(spanish[key]) }).toEqual({ key, args: signature(english[key]) });
    }
  });

  it('are not left untranslated where Spanish differs', () => {
    const allowedSame = new Set(['metrics.ctr', 'metrics.cpm', 'apps.whatsapp', 'apps.instagram', 'apps.messenger', 'facts.value.quoted', 'leads.connected', 'leads.outcome.spam', 'settingsPage.account.plan', 'settingsPage.account.accountsCount', 'drafts.runs']);
    const same = Object.keys(english).filter(k => english[k] === spanish[k] && !allowedSame.has(k));
    expect(same).toEqual([]);
  });
});
