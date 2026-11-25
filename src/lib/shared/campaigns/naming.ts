/** Deterministic campaign and ad set names built from known values. Nothing is invented. */

export const NAME_TOKENS = ['Objective', 'Initiative', 'Market', 'StartDate', 'Audience', 'Geography', 'Optimization', 'Concept', 'Variation', 'Version', 'LaunchDate'] as const;
type NameToken = (typeof NAME_TOKENS)[number];

export type NamingConfig = {
  campaign: string;
  adset: string;
  ad: string;
  separator: string;
  dateFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
};

export const defaultNaming: NamingConfig = {
  campaign: '{Objective} | {Initiative} | {Market} | {StartDate}',
  adset: '{Audience} | {Geography} | {Optimization} | {StartDate}',
  ad: '{Concept} | {Variation} | {Version} | {LaunchDate}',
  separator: ' | ',
  dateFormat: 'YYYY-MM-DD',
};

/** Fills a `|`-separated template. Parts with no known value are left out. */
export function renderName(template: string, values: Record<string, string>, config: NamingConfig) {
  const unknown = [...template.matchAll(/\{([^}]+)\}/g)].some(m => !NAME_TOKENS.includes(m[1] as NameToken));
  if (unknown) throw new Error('Unknown naming token');
  const name = template.split('|').map(part => part.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = values[key] ?? '';
    if ((key === 'StartDate' || key === 'LaunchDate') && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-');
      if (config.dateFormat === 'DD/MM/YYYY') return `${d}/${m}/${y}`;
      if (config.dateFormat === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
    }
    return value;
  }).trim()).filter(Boolean).join(config.separator);
  if (name.length > 255) throw new Error('Generated name exceeds 255 characters');
  return name;
}
