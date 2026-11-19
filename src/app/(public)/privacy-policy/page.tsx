import type { Metadata } from 'next';
import LegalDocument, { type LegalSection } from '../components/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy | DeepVisor',
  description: 'What information DeepVisor collects, how it is used and shared, how long it is kept, and how to delete it.',
  alternates: { canonical: '/privacy-policy' },
};

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are and what this covers',
    body: [
      'DeepVisor is operated by DeepVisor LLC (“DeepVisor”, “we”, “us”). DeepVisor helps local businesses understand their Meta (Facebook and Instagram) advertising: it reads a connected ad account, shows what is running and how it is performing, and points out what may deserve attention.',
      'This policy covers the DeepVisor website, the DeepVisor app, and related emails and support. It does not cover Meta, Google, or other services you use alongside DeepVisor; their own policies apply to them.',
    ],
  },
  {
    id: 'information-we-collect',
    title: 'Information we collect',
    body: [
      'Information you give us:',
      { list: [
        'Account details: your name, email address, password (stored only as a secure hash by our authentication provider), and, if you sign in with Google, the basic profile information Google shares with us (name, email address, profile picture).',
        'Business profile: details you enter about your business, such as its name, type, location, website, and how customers contact you.',
        'Messages you send us, for example support emails.',
      ] },
      'Information from Meta, when you connect it: with the permissions you approve (ads_management, ads_read, business_management, pages_show_list, pages_read_engagement, and instagram_basic), we receive:',
      { list: [
        'Identifiers and names of the ad accounts, Business accounts, Facebook Pages, and Instagram accounts you can access.',
        'Campaign, ad set, and ad names, settings, objectives, budgets, schedules, and delivery status.',
        'Ad creative, including images, videos, thumbnails, and ad text.',
        'Performance metrics such as spend, impressions, reach, clicks, and results, including summarized audience breakdowns (for example by age, gender, or placement). We do not receive the identities of people who saw or clicked your ads.',
        'An access token that lets DeepVisor read this information on your behalf, and notifications Meta sends us about changes to connected accounts.',
        'Your app-scoped Meta user ID, so a deletion request you send through Facebook reaches the right data.',
      ] },
      'Information from WhatsApp, if you connect your WhatsApp Business number (permissions whatsapp_business_management and whatsapp_business_messaging): for each customer chat, we keep the customer’s WhatsApp profile name, the last 4 digits of their number, a one-way keyed code of the number (so a returning customer is recognized without storing the number), the ad that started the chat, and the times of the first message and your first reply. We do not store message text, media, or full phone numbers. You can also mark a chat as booked, not booked, or spam, and log phone calls yourself.',
      'Information we create: observations, decision records (for example “Hold” or “not enough data yet”), summaries, sync history, and other outputs DeepVisor generates from the data above.',
      'Information collected automatically: IP address, browser and device type, pages visited within the app, error logs, and security events, which we use to run and protect the service. DeepVisor does not use advertising trackers or third-party analytics on its website.',
    ],
  },
  {
    id: 'how-we-use',
    title: 'How we use information',
    body: [
      { list: [
        'To create and secure your account and sign you in.',
        'To connect your Meta account, sync your advertising data, and show it to you in Overview, Decisions, and Campaigns.',
        'To generate observations, summaries, and decision-support outputs about your advertising.',
        'To send service messages, such as email verification, security notices, and important changes to the service or these policies.',
        'To troubleshoot, keep the service reliable, prevent abuse, and improve DeepVisor.',
        'To comply with law and enforce our Terms of Service.',
      ] },
      'DeepVisor changes your Meta advertising only when you ask it to in DeepVisor: for example renaming campaigns, ad sets, or ads, or pausing an ad set or changing its budget after you approve it. Ad drafts DeepVisor prepares stay in DeepVisor until you review and publish them. We never change your advertising on our own.',
      'We do not sell your personal information, and we do not use your Meta advertising data to advertise to you or to anyone else.',
    ],
  },
  {
    id: 'ai',
    title: 'AI and automated analysis',
    body: [
      'Some DeepVisor features use machine-learning and AI services to summarize performance, explain observations, or suggest what to review. To do this, we send those services a limited, structured selection of your advertising data, such as metrics, entity names and levels, and business context you provided.',
      'We do not send your passwords or Meta access tokens to AI services. AI outputs can be wrong or incomplete; DeepVisor labels when data is insufficient and you remain responsible for any decision you make.',
      'DeepVisor does not make decisions that produce legal or similarly significant effects about you as an individual.',
    ],
  },
  {
    id: 'sharing',
    title: 'How we share information',
    body: [
      'We share information only as needed to run DeepVisor:',
      { list: [
        'Service providers that process data on our behalf: Supabase (database, authentication, and file storage), our cloud hosting provider, OpenAI (AI summaries and explanations), and TypeSafe (decision-support model). They may use the data only to provide their services to us.',
        'Meta, when DeepVisor requests your data through Meta’s APIs under the permissions you granted, or applies a change you asked for.',
        'Google, if you choose to sign in with Google.',
        'Authorities or others when required by law, or to protect the rights, safety, and security of our users, the public, or DeepVisor.',
        'A successor organization, if DeepVisor is involved in a merger, acquisition, or sale of assets. We will notify you and this policy will continue to apply to your information.',
      ] },
      'We do not sell or rent personal information, and we do not share it for cross-context behavioral advertising.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: [
      'DeepVisor uses only cookies and browser storage that are necessary for the service to work:',
      { list: [
        'Authentication cookies that keep you signed in.',
        'Preference cookies that remember which connected Meta account and ad account you selected.',
        'Browser storage for display preferences such as light or dark theme.',
      ] },
      'We do not use advertising or cross-site tracking cookies. Blocking necessary cookies will prevent you from signing in.',
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep information',
    body: [
      { list: [
        'Account, business profile, and synced advertising data: while your account is active, or until you delete it (see Deleting your data). Disconnecting stops new data and deletes the stored Meta login, but keeps data already synced until you delete it.',
        'WhatsApp chat records: while your WhatsApp number is connected and your account is active, or until you delete them. Technical message identifiers used to avoid counting a chat twice: about 60 days.',
        'Decision records and generated outputs: while your account is active, so you can review past observations.',
        'Meta change notifications: about 30 days. Routine operational logs: about 7 days.',
        'Backups and records we must keep for legal, security, or dispute reasons: only as long as needed for those purposes.',
      ] },
      'When you delete your account or ask us to delete your data, we delete or de-identify it within 30 days, except where we are required to keep it longer.',
    ],
  },
  {
    id: 'deletion',
    title: 'Disconnecting Meta and deleting your data',
    body: [
      'Full instructions, and a way to check a deletion request, are on our Data deletion page: https://www.deepvisor.com/data-deletion. In short:',
      { list: [
        'Disconnect (Connections): stops DeepVisor’s access and deletes the stored Meta login. Data already synced is kept so your reports still work if you reconnect.',
        'Delete Meta data (Connections, owners and admins): deletes everything DeepVisor received from Meta and WhatsApp for that connection, and everything DeepVisor created from it, right away. You get a confirmation code.',
        'Delete account (Settings): deletes your account and every workspace where you are the only member, with all of its data.',
        'Remove DeepVisor in Facebook (Settings & privacy → Settings → Business integrations or Apps and websites): Meta sends us your deletion request, we delete the Meta data from every connection you made automatically, and Meta shows you a confirmation code.',
      ] },
      'Deleting Meta data keeps your DeepVisor account, business profile, and information you entered yourself, such as appointment answers and logged phone calls, until you delete your account. For any other request, email info@deepvisor.com from the address on your account.',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    body: [
      'We protect information with measures such as encrypted connections (HTTPS), access controls that keep each business’s data separate, server-side storage of access tokens, and limited staff access. No service can be perfectly secure, so please use a strong, unique password and tell us right away at info@deepvisor.com if you think your account has been compromised.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your choices and rights',
    body: [
      'You can update your account and business profile in DeepVisor, disconnect Meta, and ask us to access, correct, export, or delete your personal information by emailing info@deepvisor.com.',
      'Depending on where you live (for example, California or other U.S. states, the European Economic Area, or the United Kingdom), you may have additional rights, such as the right to object to or restrict certain processing, or to complain to a data protection authority. We will respond to verified requests within the time required by law, and we will not discriminate against you for exercising your rights.',
    ],
  },
  {
    id: 'international',
    title: 'Where information is processed',
    body: [
      'DeepVisor LLC is based in the United States, and our service providers may process information in the United States and other countries. Where required, we rely on appropriate safeguards for international transfers.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    body: [
      'DeepVisor is a business service for adults. It is not directed to anyone under 18, and we do not knowingly collect information from children. If you believe a child has given us information, contact us and we will delete it.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: [
      'We will update this policy when our practices change. If a change is significant, we will tell you by email or in the app before it takes effect. The date at the top shows when this policy was last updated.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: [
      'DeepVisor LLC. Email: info@deepvisor.com.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lastUpdated="November 19, 2026"
      lastUpdatedISO="2026-11-19"
      summary={[
        'We collect your account details, business profile, the Meta ad data you allow, and, if you connect WhatsApp, basic details of chats from your ads (never message text).',
        'DeepVisor changes your ads only when you ask or approve it; drafts stay in DeepVisor until you publish.',
        'We never sell your data. No ad trackers.',
        'Some features send limited performance data to AI providers.',
        'Disconnect, delete your Meta data, or delete your account any time; see the Data deletion page.',
      ]}
      sections={sections}
    />
  );
}
