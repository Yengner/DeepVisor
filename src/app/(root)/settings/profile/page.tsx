import { Alert } from '@mantine/core';
import { IconArrowLeft, IconArrowUpRight, IconBuildingStore, IconLock, IconUser } from '@tabler/icons-react';
import { getLocale, getTranslations } from 'next-intl/server';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createServerClient } from '@/lib/server/supabase/server';
import { BUSINESS_CATEGORY_OPTIONS, labelForOption } from '@/lib/shared/onboarding/businessProfileOptions';
import ProfileForm from '../components/ProfileForm';
import BusinessProfileForm from '../components/BusinessProfileForm';
import DeleteAccount from '../components/DeleteAccount';
import SectionCard from '../components/SectionCard';
import classes from '../SettingsSurface.module.css';

export default async function ProfilePage() {
  const { user, businessId, organizationName, role } = await getRequiredAppContext();
  const t = await getTranslations('profilePage');
  const locale = await getLocale();
  const supabase = await createServerClient();
  const { data: business, error: businessError } = await supabase.from('business_profiles')
    .select('business_name, industry, website, monthly_budget, description').eq('id', businessId).maybeSingle();

  const formatDate = (value: string | null) => {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
      : t('notAvailable');
  };
  const fullName = `${user.first_name} ${user.last_name}`.trim() || t('title');
  const initials = [user.first_name, user.last_name].filter(Boolean).map(name => name[0]).join('').toUpperCase();
  const status = user.status?.toLowerCase();
  const active = status === 'active';
  const canEdit = role === 'owner' || role === 'admin';

  return (
    <div className={`${classes.page} dv-app-page`}>
      <a href="/settings" className={classes.back}><IconArrowLeft size={18} aria-hidden />{t('back')}</a>
      <header className={classes.header}>
        <SpiderMascot state="idle" size={64} />
        <div className={classes.headerText}>
          <h1 className={classes.title}>{t('title')}</h1>
          <p className={classes.lead}>{t('lead')}</p>
        </div>
      </header>

      <div className={classes.profileLayout}>
        <div className={classes.stack}>
          <SectionCard id="account" icon={<IconUser size={22} />} title={t('person')}>
            <ProfileForm initial={user} />
          </SectionCard>

          <SectionCard id="business-profile" icon={<IconBuildingStore size={22} />} title={t('businessLink')}>
            {business ? <BusinessProfileForm
              showHeading={false}
              canEdit={canEdit}
              initial={{ businessName: business.business_name, industry: business.industry ?? '', website: business.website ?? '', monthlyBudget: business.monthly_budget ?? '', description: business.description ?? '' }}
            /> : <Alert color="red">{t('businessLoadError')}</Alert>}
          </SectionCard>
        </div>

        <aside className={classes.aside} aria-label={t('person')}>
          <section className={classes.section} aria-labelledby="account-details-title">
            <div className={classes.identity}>
              <span className={classes.avatar} aria-hidden>{initials || '?'}</span>
              <div>
                <strong id="account-details-title">{fullName}</strong>
                <span>{business?.business_name || organizationName}</span>
              </div>
            </div>
            <dl className={classes.facts} style={{ marginBottom: 0 }}>
              <div><dt>{t('status')}</dt><dd><span className={`${classes.pill} ${active ? classes.pillOk : ''} ${classes.capital}`}>{active ? t('statusActive') : status ?? t('notAvailable')}</span></dd></div>
              <div><dt>{t('memberSince')}</dt><dd>{formatDate(user.created_at)}</dd></div>
              <div><dt>{t('updated')}</dt><dd>{formatDate(user.updated_at)}</dd></div>
            </dl>
          </section>

          <section className={classes.section} aria-labelledby="workspace-title">
            <h2 id="workspace-title" className={classes.subTitle}>{t('workspace')}</h2>
            <dl className={classes.facts} style={{ marginBottom: 0 }}>
              <div><dt>{t('role')}</dt><dd className={classes.capital}>{role}</dd></div>
              {business?.industry && <div><dt>{t('category')}</dt><dd>{labelForOption(business.industry, BUSINESS_CATEGORY_OPTIONS, business.industry.replaceAll('_', ' '))}</dd></div>}
            </dl>
            {businessError && <Alert color="red" mt="sm">{t('workspaceLoadError')}</Alert>}
            <p className={classes.subLead} style={{ margin: '12px 0 0' }}>{t('settingsHint')}</p>
            <a href="/settings#workspace" className={classes.inlineLink}>{t('settingsLink')}<IconArrowUpRight size={16} aria-hidden /></a>
          </section>

          <p className={classes.note}><IconLock size={18} aria-hidden />{t('roleNote')}</p>

          <section className={classes.danger} aria-label={t('danger')}>
            <DeleteAccount />
          </section>
        </aside>
      </div>
    </div>
  );
}
