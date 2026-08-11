const lastUpdated = 'May 20, 2026';

const sections = [
  {
    title: '1. Overview',
    body: [
      'DeepVisor helps businesses connect advertising accounts, review campaign performance, generate reports, and turn deterministic ad metrics into decision-support insights. This Privacy Policy explains what information we collect, how we use it, and the choices available to you.',
      'This policy applies to DeepVisor websites, dashboards, reports, integrations, notifications, and related services that link to this policy.',
    ],
  },
  {
    title: '2. Information We Collect',
    body: [
      'Account information: first name, last name, email address, phone number, authentication metadata, and account settings.',
      'Workspace information: business profile details, organization membership, selected platform, selected ad account, notification preferences, and calendar queue settings.',
      'Advertising integration information: connected platform identifiers, ad account identifiers, OAuth connection metadata, access credentials needed to operate the integration, campaign/ad set/ad names and IDs, delivery status, objectives, performance metrics, audience breakdown summaries, sync state, and report outputs.',
      'Generated intelligence: campaign reviews, campaign reports, trend findings, recommendations, queue results, notifications, AI generation audit metadata, and account intelligence snapshots.',
      'Technical information: IP address, browser or device metadata, logs, error reports, security events, and usage events needed to operate and improve the service.',
    ],
  },
  {
    title: '3. How We Use Information',
    body: [
      'We use information to create and secure accounts, connect platform integrations, sync ad performance data, generate dashboards and reports, run scheduled queue workflows, provide notifications, improve product reliability, prevent abuse, and support users.',
      'DeepVisor uses deterministic calculations to decide what happened in your ad account. AI may be used to summarize, explain, prioritize, and draft safe next steps. AI does not directly publish, pause, extend, or change platform campaigns without explicit user approval.',
    ],
  },
  {
    title: '4. AI Processing',
    body: [
      'Some report and campaign review workflows may send a limited, structured subset of ad performance metrics, findings, queue metadata, and business context to AI providers so DeepVisor can generate summaries or decision-support narratives.',
      'We do not intentionally send platform access tokens, passwords, or full authentication secrets to AI providers. AI outputs are stored so users can view past reviews, audit queue results, and keep long-term account memory.',
    ],
  },
  {
    title: '5. Platform Integrations',
    body: [
      'If you connect Meta or another advertising platform, DeepVisor processes data made available through that platform’s APIs and permissions you grant. You can disconnect integrations from DeepVisor or the platform account settings.',
      'Platform services are provided by third parties and are governed by their own terms and policies. DeepVisor is not responsible for third-party platform availability, API changes, or data provided by those platforms.',
    ],
  },
  {
    title: '6. How We Share Information',
    body: [
      'We do not sell personal information. We may share information with service providers that help us host, secure, analyze, support, and operate DeepVisor, such as database, hosting, analytics, communications, payment, platform API, and AI infrastructure providers.',
      'We may disclose information when required by law, to protect rights and safety, to prevent abuse, or as part of a merger, acquisition, financing, or business transfer.',
    ],
  },
  {
    title: '7. Data Retention',
    body: [
      'DeepVisor is designed to keep recent detailed ad performance data, compact long-term summaries, reports, findings, queue records, and account intelligence snapshots. Detailed high-volume rows may be retained for shorter periods while summaries and saved intelligence may be retained longer.',
      'We retain account and workspace data while your account is active and as needed for legitimate business, security, legal, and operational purposes. You may request deletion by contacting us.',
    ],
  },
  {
    title: '8. Security',
    body: [
      'We use administrative, technical, and organizational safeguards designed to protect information. No internet service can be guaranteed to be completely secure, and you are responsible for keeping your login credentials safe.',
      'Do not share platform access or DeepVisor credentials with unauthorized users. Contact us promptly if you believe your account or integration has been compromised.',
    ],
  },
  {
    title: '9. Your Choices And Rights',
    body: [
      'You can update account information, disconnect integrations, manage notification preferences, and request access, correction, export, or deletion of personal information by contacting us.',
      'Depending on where you live, you may have additional privacy rights. We will respond to valid requests as required by applicable law.',
    ],
  },
  {
    title: '10. Communications',
    body: [
      'We may send transactional messages about account security, integrations, queue results, reports, and product updates. We only send marketing SMS or WhatsApp messages where we have the required consent. You may opt out of marketing communications, but operational messages may still be necessary to provide the service.',
    ],
  },
  {
    title: '11. Children',
    body: [
      'DeepVisor is not directed to children under 13, and we do not knowingly collect personal information from children.',
    ],
  },
  {
    title: '12. Changes',
    body: [
      'We may update this Privacy Policy from time to time. If changes are material, we will provide notice through the site, dashboard, email, or another reasonable method.',
    ],
  },
  {
    title: '13. Contact',
    body: [
      'Questions or requests can be sent to info@deepvisor.com.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lastUpdated={lastUpdated}
      intro="This policy is written to describe DeepVisor’s current product direction and data practices. It is not a substitute for legal advice."
      sections={sections}
    />
  );
}
import LegalDocument from '../components/LegalDocument';
