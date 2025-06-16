'use client';

import Hero from "@/components/public/Hero";
import Testimonials from "@/components/public/Testimonials";
import Pricing from "@/components/public/Pricing/Pricing";
import CTA from "@/components/public/CTA";
import Container from "@/components/public/Container";
import Benefits from "@/components/public/Benefits/Benefits";
import Section from "@/components/public/Section";
import FAQ from "@/components/public/FAQ";
import Stats from "@/components/public/Stats";
import Logos from "@/components/public/Logos";

const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <Logos />
      <Container>
        <Benefits />

        {/* <Section
          id="pricing"
          title="Pricing"
          description="We are in development of our software to revolutionize the way you manage your ad campaigns. Our pricing is designed to be flexible and affordable, ensuring you get the best value for your investment. **** As of now, we are only offering our main service, DeepVisor, which includes comprehensive ad management and optimization services. Our team will handle all aspects of your campaigns, ensuring maximum ROI and performance. Please submit your free estimate form to get started or contact us. ****"
        >
          <Pricing />
        </Section> */}

        <Section
          id="testimonials"
          title="What Our Clients Say"
          description="Hear from those who have partnered with us."
        >
          <Testimonials />
        </Section>

        <FAQ />

        <Stats />

        <CTA />
      </Container>
    </>
  );
};

export default HomePage;