import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const MIGRATION = 'supabase/migrations/20261114233828_business_profile_location_provenance.sql';

it('adds structured location and provenance columns idempotently with their checks', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table public.business_profiles(
      id uuid primary key default gen_random_uuid(),
      business_name text,
      business_location text
    );
    insert into public.business_profiles(business_name, business_location) values ('Existing', 'Tampa, FL');`);

    const sql = readFileSync(MIGRATION, 'utf8');
    await db.exec(sql);
    await db.exec(sql);

    expect((await db.query('select field_sources, location_mode, onboarding_completed_at from public.business_profiles')).rows)
      .toEqual([{ field_sources: {}, location_mode: null, onboarding_completed_at: null }]);

    await db.exec(`insert into public.business_profiles(business_name, location_mode, location_city, location_region, location_country, field_sources)
      values ('Bayside', 'service_area', 'Tampa', 'FL', 'US', '{"industry":{"source":"user","updated_at":"2026-11-14T00:00:00Z"}}')`);

    await expect(db.exec("insert into public.business_profiles(business_name, location_mode) values ('x', 'mobile')"))
      .rejects.toThrow(/location_mode_check/);
    await expect(db.exec("insert into public.business_profiles(business_name, location_country) values ('x', 'us')"))
      .rejects.toThrow(/location_country_check/);
    await expect(db.exec(`insert into public.business_profiles(business_name, field_sources) values ('x', '[]')`))
      .rejects.toThrow(/field_sources_object_check/);
    await expect(db.exec(`insert into public.business_profiles(business_name, field_sources) values ('x', null)`))
      .rejects.toThrow();
  } finally {
    await db.close();
  }
});
