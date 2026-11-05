import { snapshotMetric, type AudienceView, type BreakdownMetric } from './breakdowns';
import type { ReportSnapshotMeasurement } from '@/lib/server/reports/types';

export const GENDERS = ['Female', 'Male', 'Unknown'] as const;
export const AGE_BUCKET_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export type Gender = typeof GENDERS[number];
export type AudienceObservation = Pick<ReportSnapshotMeasurement, 'values' | 'currencyCode'> & { date: string; age: string; gender: string };
export function normalizeGender(value: string): Gender {
  const normalized = value.trim().toLowerCase();
  return normalized === 'female' ? 'Female' : normalized === 'male' ? 'Male' : 'Unknown';
}
export function ageBucketSortValue(value: string) {
  const normalized = value.trim();
  const index = AGE_BUCKET_ORDER.indexOf(normalized as typeof AGE_BUCKET_ORDER[number]);
  if (index >= 0) return index;
  if (/^\d+\+$/.test(normalized)) return 900 + Number.parseInt(normalized, 10);
  return /^(\d+)\s*-\s*(\d+)$/.test(normalized) ? Number.parseInt(normalized, 10) : 10_000;
}
const normalizeAge = (age: string) => AGE_BUCKET_ORDER.find(a => a === age.trim()) ?? 'Unknown';
/** Extracted from the legacy dashboard's age/gender bucketing. Rates use Reports' aggregate inputs. */
export function buildAgeGenderAudienceChart(observations: AudienceObservation[], metric: BreakdownMetric, view: AudienceView = 'age_gender') {
  const normalized = observations.map(row => ({ ...row, age: normalizeAge(row.age), gender: normalizeGender(row.gender) }));
  const labels = [...new Set(normalized.map(row => view === 'gender' ? row.gender : row.age))]
    .sort((a, b) => view === 'gender' ? GENDERS.indexOf(a as Gender) - GENDERS.indexOf(b as Gender) : ageBucketSortValue(a) - ageBucketSortValue(b));
  const ratio = ['ctr', 'costPerResult', 'cpc', 'cpm'].includes(metric);
  const rows = labels.map(label => {
    const items = normalized.filter(row => (view === 'gender' ? row.gender : row.age) === label);
    return { label, total: snapshotMetric(items, metric),
      ...Object.fromEntries(GENDERS.map(gender => [gender, snapshotMetric(items.filter(r => r.gender === gender), metric)])),
    } as { label: string; total: number | null } & Record<Gender, number | null>;
  });
  return { rows, stacked: view === 'age_gender' && !ratio, series: view === 'age_gender' ? [...GENDERS] : ['total'] };
}
