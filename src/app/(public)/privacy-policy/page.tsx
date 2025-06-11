export default function PrivacyPolicyPage() {
  return (
    <div className="p-8 pt-28 mx-auto max-w-4xl">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Privacy Policy</h1>
        <p className="text-gray-600 mb-8">
          <strong>Effective Date:</strong> 06/11/2025
        </p>

        {/* Section 1: Introduction */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Introduction</h2>
          <p className="text-gray-700">
            DeepVisor (“we”, “us”, or “our”) is an AI-powered marketing dashboard and ad management platform for business owners and digital marketers. This Privacy Policy explains how we collect, use, disclose, and protect your information when you visit or use our services, including our website <a href="https://deepvisor.com" className="text-blue-600 underline">deepvisor.com</a>.
          </p>
        </section>

        {/* Section 2: Information We Collect */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Information We Collect</h2>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">2.1 Personal Information</h3>
            <p className="text-gray-700">When you sign up for DeepVisor or opt in for communications, we may collect:</p>
            <ul className="list-disc list-inside text-gray-700 mt-2">
              <li>Full name</li>
              <li>Email address</li>
              <li>Business name</li>
              <li>Phone number</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">2.2 Authentication & Integration Data</h3>
            <p className="text-gray-700">To integrate with marketing platforms, we collect:</p>
            <ul className="list-disc list-inside text-gray-700 mt-2">
              <li>OAuth tokens (e.g., Meta for Facebook & Instagram)</li>
              <li>Ad account IDs, Page IDs</li>
              <li>WhatsApp phone numbers (for lead messaging)</li>
            </ul>
          </div>

          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">2.3 Marketing & Ad Performance Data</h3>
            <p className="text-gray-700">We also gather:</p>
            <ul className="list-disc list-inside text-gray-700 mt-2">
              <li>Campaign/ad set/ad details (e.g., spend, impressions, leads)</li>
              <li>Engagement metrics (likes, clicks)</li>
              <li>Organic post content and analytics</li>
            </ul>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">2.4 Other Information</h3>
            <p className="text-gray-700">Additionally, we may collect:</p>
            <ul className="list-disc list-inside text-gray-700 mt-2">
              <li>Login metadata (IP address, device info)</li>
              <li>Billing details (processed via Stripe or similar)</li>
            </ul>
          </div>
        </section>

        {/* Section 3: How We Use Your Information */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside text-gray-700 mt-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Personalize your experience on DeepVisor</li>
            <li>Manage and optimize your ad campaigns</li>
            <li>Sync data with third-party platforms</li>
            <li>Generate performance reports and insights</li>
            <li>Communicate updates, offers, and support</li>
            <li>Ensure security and detect fraud</li>
          </ul>
        </section>

        {/* Section 4: SMS & WhatsApp Opt-In Policy */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. SMS & WhatsApp Opt-In Policy</h2>
          <p className="text-gray-700">
            We will only send SMS or WhatsApp messages to you if you have <strong>explicitly opted in</strong> to receive such communications. By providing your phone number and replying <em>YES</em>, you consent to receive messages from DeepVisor. You can withdraw consent at any time by replying <em>STOP</em>. After opting out, you will no longer receive marketing messages, though transactional messages may still be sent to complete active requests.
          </p>
        </section>

        {/* Section 5: How We Share Your Information */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. How We Share Your Information</h2>
          <p className="text-gray-700">We do not sell your personal data. We may share information with:</p>
          <ul className="list-disc list-inside text-gray-700 mt-2">
            <li>Cloud storage providers (e.g., Supabase, AWS)</li>
            <li>Payment processors (e.g., Stripe)</li>
            <li>Third-party API services (e.g., Meta Marketing API)</li>
          </ul>
        </section>

        {/* Section 6: Data Retention */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Data Retention</h2>
          <p className="text-gray-700">
            We retain your data as long as necessary to fulfill service obligations, comply with legal requirements, and support our operations. When no longer needed, data is securely deleted or anonymized.
          </p>
        </section>

        {/* Section 7: International Transfers */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. International Transfers</h2>
          <p className="text-gray-700">
            DeepVisor operates globally. Your data may be transferred to and processed in countries outside your residence. We ensure data protection through applicable safeguards such as GDPR and CCPA compliance.
          </p>
        </section>

        {/* Section 8: Your Rights */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Your Rights</h2>
          <p className="text-gray-700">Depending on your jurisdiction, you may have rights to:</p>
          <ul className="list-disc list-inside text-gray-700 mt-2">
            <li>Access and receive a copy of your data</li>
            <li>Correct or update inaccurate information</li>
            <li>Request deletion of personal data</li>
            <li>Restrict or object to processing</li>
            <li>Data portability</li>
          </ul>
          <p className="text-gray-700">To exercise these rights, contact us at support@deepvisor.com.</p>
        </section>

        {/* Section 9: Security */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Security</h2>
          <p className="text-gray-700">
            We employ industry-standard measures to protect your data. However, no method is 100% secure. We continually review and improve our security practices.
          </p>
        </section>

        {/* Section 10: Changes to This Policy */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Changes to This Policy</h2>
          <p className="text-gray-700">
            We may update this policy. Changes will be posted here with a revised effective date. Please review periodically.
          </p>
        </section>

        {/* Section 11: Contact Us */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Contact Us</h2>
          <p className="text-gray-700">
            If you have questions or concerns, reach out to us at:<br />
            <strong>Email:</strong> info@deepvisor.com<br />
          </p>
        </section>
      </div>
    </div>
  );
}
