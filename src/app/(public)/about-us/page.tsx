export default function AboutUsPage() {
    return (
      <div className="bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-r pt-44 py-20">
          <div className="max-w-4xl mx-auto text-center px-4">
            <h1 className="text-5xl font-extrabold mb-4">About DeepVisor</h1>
            <p className="text-xl">Empowering Your Marketing with AI &amp; Automation</p>
          </div>
        </div>
  
        <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">
          {/* Section 1: Introduction */}
          <section className="flex flex-col md:flex-row items-center gap-8">
            <img
              src="/images/about/founder.jpeg"
              alt="Yengner Bermudez"
              className="w-full md:w-1/2 rounded-lg shadow-lg"
            />
            <div className="md:w-1/2 space-y-4">
              <h2 className="text-3xl font-semibold text-gray-800">Meet the Founder</h2>
              <p className="text-gray-700 leading-relaxed">
                I'm <strong>Yengner E. Bermudez</strong>, a Computer Science &amp; Engineering student at USF,
                born and raised in Tampa. DeepVisor is my passion project—a mission to bring honest,
                effective solutions to businesses without the scams or empty promises.
              </p>
            </div>
          </section>
  
          {/* Section 2: What We Do */}
          <section className="bg-white p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold text-gray-800 mb-6">What We Do</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <img src="/images/icons/automation.svg" alt="Automation" className="mx-auto h-12 mb-4" />
                <h3 className="font-medium text-gray-900">Automation</h3>
                <p className="text-gray-600">
                  Streamline workflows with custom automations that save you time and reduce errors.
                </p>
              </div>
              <div className="text-center">
                <img src="/images/icons/ads.svg" alt="Ad Management" className="mx-auto h-12 mb-4" />
                <h3 className="font-medium text-gray-900">Ad Management</h3>
                <p className="text-gray-600">
                  Launch and optimize Meta campaigns that drive leads, sales, and measurable ROI.
                </p>
              </div>
              <div className="text-center">
                <img src="/images/icons/analytics.svg" alt="Analytics" className="mx-auto h-12 mb-4" />
                <h3 className="font-medium text-gray-900">Analytics</h3>
                <p className="text-gray-600">
                  Gain deep insights with real-time dashboards and AI-driven recommendations.
                </p>
              </div>
            </div>
          </section>
  
          {/* Section 3: Why We Do It */}
          <section className="flex flex-col md:flex-row items-center gap-8 ">
            <div className="md:w-1/2 space-y-4 from-blue-300 to-indigo-400 bg-gradient-to-r p-8 rounded-lg shadow-lg">
              <h2 className="text-3xl font-semibold text-gray-800">Why We Do It</h2>
              <p className="text-gray-700 leading-relaxed">
                My passion for technology and problem-solving inspired DeepVisor to bridge the gap
                between engineering and business. We're committed to delivering integrity-driven
                services that create real value for our clients—not just profits.
              </p>
            </div>
            <img
              src="/images/about/mission.jpg"
              alt="Our Mission"
              className="w-full md:w-1/2 rounded-lg shadow-lg"
            />
          </section>
  
          {/* Section 4: Success Stories */}
          <section className="bg-white p-8 rounded-lg shadow-lg">
            <h2 className="text-3xl font-semibold text-gray-800 mb-6">Success Stories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex items-start gap-4">
                <img src="/images/clients/jj_sunshine.png" alt="J&J Sunshine Rentals" className="h-12 w-12 rounded" />
                <div>
                  <h4 className="font-medium text-gray-900">J&amp;J Sunshine Rentals</h4>
                  <p className="text-gray-600">
                    "Increased leads by 85% in 3 months and generated $60k/month in revenue."
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <img src="/images/clients/adas_salon.png" alt="Ada's Secret Salon" className="h-12 w-12 rounded" />
                <div>
                  <h4 className="font-medium text-gray-900">Ada's Secret Salon</h4>
                  <p className="text-gray-600">
                    "+85 Leads &amp; $60,000/month. Our salon has never been busier!"
                  </p>
                </div>
              </div>
            </div>
          </section>
  
          {/* Section 5: Our Vision */}
          <section className="text-center space-y-4">
            <h2 className="text-3xl font-semibold text-gray-800">Our Vision</h2>
            <p className="text-gray-700 leading-relaxed max-w-2xl mx-auto">
              DeepVisor is evolving into a unified platform combining AI-driven marketing
              automation with consulting expertise. We aim to be the trusted partner that empowers
              businesses to thrive in the digital age.
            </p>
          </section>
        </div>
      </div>
    );
  }
  