import { Alert, Avatar, Badge, Card, Container, Group, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconArrowUpRight, IconBuilding, IconLock } from '@tabler/icons-react';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createServerClient } from '@/lib/server/supabase/server';
import ProfileForm from '../components/ProfileForm';
import BusinessProfileForm from '../components/BusinessProfileForm';
import DeleteAccount from '../components/DeleteAccount';
import classes from './ProfilePage.module.css';

function formatDate(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default async function ProfilePage() {
  const { user, businessId, organizationName, role } = await getRequiredAppContext();
  const supabase = await createServerClient();
  const { data: business, error: businessError } = await supabase.from('business_profiles')
    .select('business_name, industry, website, monthly_budget, description').eq('id', businessId).maybeSingle();
  const fullName = `${user.first_name} ${user.last_name}`.trim() || 'Your profile';
  const initials = [user.first_name, user.last_name].filter(Boolean).map(name => name[0]).join('').toUpperCase();
  const status = user.status?.toLowerCase();

  return (
    <Container size="xl" className={classes.page}>
      <a href="/settings" className={classes.backLink}><IconArrowLeft size={16} aria-hidden />All settings</a>
      <header className={classes.header}>
        <div>
          <Text className={classes.eyebrow}>Account settings</Text>
          <Title order={1}>Your profile</Title>
          <Text className={classes.description}>Manage your personal details, sign-in email, and business profile.</Text>
          <a href="#business-profile" className={classes.workspaceLink}>Business details<IconArrowUpRight size={16} aria-hidden /></a>
        </div>
      </header>

      <div className={classes.layout}>
        <div className={classes.content}>
          <Card withBorder className={classes.editor} component="section" aria-label="Edit your profile">
            <ProfileForm initial={user} />
          </Card>
          <Card withBorder className={classes.editor} component="section" id="business-profile" aria-label="Business details">
            {business ? <BusinessProfileForm
              canEdit={role === 'owner' || role === 'admin'}
              initial={{ businessName: business.business_name, industry: business.industry ?? '', website: business.website ?? '', monthlyBudget: business.monthly_budget ?? '', description: business.description ?? '' }}
            /> : <Alert color="red">Business details could not be loaded. Reload the page to try again.</Alert>}
          </Card>
        </div>

        <aside className={classes.sidebar} aria-label="Account information">
          <Card withBorder className={classes.card} component="section" aria-labelledby="account-details-title">
            <Group gap="md" wrap="nowrap" className={classes.identity}>
              <Avatar size={48} radius="xl" className={classes.avatar}>{initials || '?'}</Avatar>
              <div className={classes.identityText}>
                <Title order={2} id="account-details-title">{fullName}</Title>
                <Text size="sm" className={classes.muted}>Personal account</Text>
              </div>
            </Group>
            <dl className={classes.details}>
              <div><dt>Account status</dt><dd><Badge variant="light" color={status === 'active' ? 'signal' : 'gray'} className={`${classes.status} ${status === 'active' ? classes.activeStatus : ''}`}>{status ? status[0].toUpperCase() + status.slice(1) : 'Not available'}</Badge></dd></div>
              <div><dt>Member since</dt><dd>{formatDate(user.created_at)}</dd></div>
              <div><dt>Profile updated</dt><dd>{formatDate(user.updated_at)}</dd></div>
            </dl>
          </Card>

          <Card withBorder className={classes.card} component="section" aria-labelledby="workspace-title">
            <Group gap="xs" mb="sm"><IconBuilding size={18} aria-hidden /><Title order={2} id="workspace-title">Your workspace</Title></Group>
            <Text fw={600} className={classes.workspaceName}>{business?.business_name || organizationName}</Text>
            <dl className={classes.details}>
              <div><dt>Your role</dt><dd className={classes.role}>{role}</dd></div>
              {business?.industry && <div><dt>Industry</dt><dd>{business.industry.replaceAll('_', ' ')}</dd></div>}
            </dl>
            {businessError && <Alert color="red" mt="sm">Workspace details could not be loaded. Please try again later.</Alert>}
            <a href="#business-profile" className={classes.workspaceLink}>Business details<IconArrowUpRight size={16} aria-hidden /></a>
            <Text size="sm" className={classes.muted}>Service area, booking links, and campaign preferences are available in <a href="/settings#workspace" className={classes.inlineLink}>Settings</a>.</Text>
          </Card>

          <div className={classes.securityNote}>
            <IconLock size={18} aria-hidden />
            <Text size="sm">Your role and account status are managed by the workspace. Updating your profile does not change your access.</Text>
          </div>

          <div className={classes.dangerZone}><DeleteAccount /></div>
        </aside>
      </div>
    </Container>
  );
}
