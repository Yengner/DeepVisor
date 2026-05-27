const lastUpdated = 'May 20, 2026';

const sections = [
  {
    title: '1. Agreement To These Terms',
    body: [
      'These Terms of Service govern your access to and use of DeepVisor websites, dashboards, reports, integrations, notifications, queue workflows, and related services. By creating an account or using DeepVisor, you agree to these Terms.',
      'If you use DeepVisor on behalf of a business or organization, you represent that you have authority to bind that business or organization to these Terms.',
    ],
  },
  {
    title: '2. What DeepVisor Does',
    body: [
      'DeepVisor provides advertising account intelligence, reporting, campaign review workflows, scheduled reviews, notifications, and decision-support summaries for connected ad accounts.',
      'DeepVisor is a decision-support product. Deterministic metrics decide what happened. AI may help explain why it matters, prioritize what to review, and draft safe next steps.',
    ],
  },
  {
    title: '3. User Control And Approval',
    body: [
      'DeepVisor does not directly publish, pause, extend, change budgets, or otherwise execute platform-level campaign changes without explicit user approval.',
      'You are responsible for reviewing any recommendation, draft, report, or queue result before taking action in an advertising platform or approving any future automation feature.',
    ],
  },
  {
    title: '4. Accounts And Security',
    body: [
      'You must provide accurate account information and keep your login credentials secure. You are responsible for activity under your account and workspace.',
      'You must promptly notify us if you believe your account, organization, or connected platform integration has been compromised.',
    ],
  },
  {
    title: '5. Platform Integrations',
    body: [
      'You may connect DeepVisor to third-party platforms such as Meta. You authorize DeepVisor to access, sync, process, store, and display information available through the permissions you grant.',
      'Third-party platforms are governed by their own terms and policies. DeepVisor is not responsible for third-party outages, API limits, rejected ads, attribution changes, policy decisions, or platform data inaccuracies.',
    ],
  },
  {
    title: '6. AI And Reports',
    body: [
      'AI-generated summaries and recommendations may be incomplete, incorrect, or based on limited data. DeepVisor attempts to ground AI outputs in stored metrics and deterministic findings, but you should independently review decisions before acting.',
      'Reports, findings, and recommendations are not legal, financial, accounting, tax, or professional marketing advice. They are informational decision-support outputs.',
    ],
  },
  {
    title: '7. Acceptable Use',
    body: [
      'You may not use DeepVisor to violate law, infringe rights, bypass platform policies, send spam, upload malicious code, attempt unauthorized access, reverse engineer protected parts of the service, or interfere with service operation.',
      'You may not use DeepVisor to manage ad accounts unless you have the right to access and process those accounts and related data.',
    ],
  },
  {
    title: '8. Fees, Trials, And Plans',
    body: [
      'DeepVisor may offer free trials, paid plans, usage limits, or plan-based data retention rules. Plan details, if any, are shown in the product or order flow.',
      'We may change pricing, features, or limits with reasonable notice where required. If paid subscriptions are enabled, payment processing may be handled by a third-party payment processor.',
    ],
  },
  {
    title: '9. Your Data And Content',
    body: [
      'You retain ownership of your business information and connected account data. You grant DeepVisor the rights needed to host, process, analyze, display, and generate outputs from that data to provide the service.',
      'You are responsible for ensuring that your use of DeepVisor and any data you connect or upload complies with applicable laws, contracts, and platform policies.',
    ],
  },
  {
    title: '10. DeepVisor Intellectual Property',
    body: [
      'DeepVisor, including its software, interface, workflows, models, designs, reports, and documentation, is owned by DeepVisor or its licensors and is protected by intellectual property laws.',
      'You may not copy, resell, sublicense, or exploit DeepVisor except as allowed by these Terms or written permission from us.',
    ],
  },
  {
    title: '11. Service Changes And Availability',
    body: [
      'We may modify, suspend, or discontinue parts of the service. We aim to keep DeepVisor reliable, but we do not guarantee uninterrupted availability, error-free operation, or compatibility with every third-party platform change.',
    ],
  },
  {
    title: '12. Termination',
    body: [
      'You may stop using DeepVisor at any time. We may suspend or terminate access if you violate these Terms, create risk, fail to pay applicable fees, or use the service in a way that could harm users, platforms, or DeepVisor.',
    ],
  },
  {
    title: '13. Disclaimers',
    body: [
      'DeepVisor is provided “as is” and “as available” to the fullest extent permitted by law. We disclaim warranties of merchantability, fitness for a particular purpose, non-infringement, and any warranties arising from course of dealing or usage of trade.',
      'We do not guarantee advertising results, lead volume, revenue, return on ad spend, campaign approval, platform delivery, or business outcomes.',
    ],
  },
  {
    title: '14. Limitation Of Liability',
    body: [
      'To the fullest extent permitted by law, DeepVisor will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost revenue, lost data, business interruption, or advertising platform decisions.',
      'To the fullest extent permitted by law, our total liability for claims relating to the service will not exceed the amount you paid to DeepVisor for the service in the three months before the event giving rise to the claim, or $100 if you have not paid us.',
    ],
  },
  {
    title: '15. Changes To These Terms',
    body: [
      'We may update these Terms from time to time. If changes are material, we will provide notice through the site, dashboard, email, or another reasonable method. Continued use after changes means you accept the updated Terms.',
    ],
  },
  {
    title: '16. Contact',
    body: [
      'Questions about these Terms can be sent to info@deepvisor.com.',
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="bg-[#f7f9fc] px-4 py-12 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600">
          DeepVisor legal
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-slate-500">
          <strong>Last updated:</strong> {lastUpdated}
        </p>
        <p className="mt-6 text-base leading-7 text-slate-700">
          These Terms are a practical product-facing draft and are not a substitute for legal
          advice. Have counsel review them before relying on them for production customers.
        </p>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-slate-900">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="leading-7 text-slate-700">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
