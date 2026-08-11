'use client';

import { useState, type ComponentType } from 'react';
import { Button } from '@mantine/core';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Mail,
  Rocket,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createCheckoutSession } from '@/lib/server/actions/stripe/stripe.actions';
import { LegacyAuthFrame } from '../LegacyAuthFrame';
import classes from '../LegacyAuth.module.css';

type PaidPlanCode = 'TIER1' | 'TIER2' | 'TIER3';
type PlanCode = PaidPlanCode | 'AGENCY';

type Plan = {
  code: PlanCode;
  name: string;
  price: string;
  description: string;
  features: readonly string[];
  icon: ComponentType<{ size?: number }>;
  popular?: boolean;
};

const PLANS: readonly Plan[] = [
  {
    code: 'TIER1',
    name: 'Starter',
    price: '$50 / month',
    description: 'A focused workspace for a business operating one ad account.',
    features: ['1 connected ad account', 'Meta campaign intelligence', 'Reports and review queue'],
    icon: Rocket,
  },
  {
    code: 'TIER2',
    name: 'Growth',
    price: '$150 / month',
    description: 'Multi-account visibility for teams running a broader ad operation.',
    features: ['Up to 5 ad accounts', 'Multi-account workspace', 'Reports and review queue'],
    icon: TrendingUp,
    popular: true,
  },
  {
    code: 'TIER3',
    name: 'Premium',
    price: '$300 / month',
    description: 'Expanded account capacity and support for established operators.',
    features: ['Expanded account capacity', 'Multi-account workspace', 'Priority support'],
    icon: Sparkles,
  },
  {
    code: 'AGENCY',
    name: 'Managed service',
    price: 'Custom',
    description: 'A directly managed operating plan scoped with the DeepVisor team.',
    features: ['Managed service scope', 'Direct strategy support', 'Custom operating plan'],
    icon: Building2,
  },
];

const COMPARISON_ROWS = [
  ['Connected ad accounts', '1', 'Up to 5', 'Expanded', 'Scoped with team'],
  ['Workspace mode', 'Single account', 'Multiple accounts', 'Multiple accounts', 'Managed'],
  ['Campaign intelligence', 'Included', 'Included', 'Included', 'Included'],
  ['Reporting and reviews', 'Included', 'Included', 'Included', 'Included'],
  ['Checkout', 'Self-serve', 'Self-serve', 'Self-serve', 'Contact team'],
] as const;

export default function PlansPage() {
  const [selectedPlan, setSelectedPlan] = useState<PaidPlanCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlanDetails = PLANS.find((plan) => plan.code === selectedPlan);

  async function handleCheckout() {
    if (!selectedPlan || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await toast.promise(createCheckoutSession(selectedPlan), {
        loading: 'Preparing secure checkout...',
        success: 'Opening checkout...',
        error: 'Checkout could not be prepared.',
      });

      if (!result.url) {
        throw new Error('Checkout did not return a destination.');
      }

      window.location.assign(result.url);
    } catch (checkoutError) {
      console.error('Checkout failed:', checkoutError);
      setError('Checkout could not be started. Please retry or contact the DeepVisor team.');
      setIsLoading(false);
    }
  }

  return (
    <LegacyAuthFrame
      eyebrow="Access selection"
      title="Choose the right operating tier."
      description="Select a paid workspace tier, then complete billing through Stripe before setup continues."
      steps={['Account verified', 'Select access', 'Workspace setup']}
      activeStep={1}
      wide
    >
      <header className={classes.pageHeader}>
        <div>
          <p className={classes.surfaceKicker}>DeepVisor plans</p>
          <h2>Workspace access</h2>
          <p>Compare account capacity and select the tier that matches your current operation.</p>
        </div>
      </header>

      <section className={classes.planGrid} aria-label="Available plans">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.code;

          if (plan.code === 'AGENCY') {
            return (
              <a
                key={plan.code}
                className={classes.agencyCard}
                href="mailto:info@deepvisor.com?subject=DeepVisor%20managed%20service"
              >
                <span className={classes.planTopline}>
                  <span className={classes.planIcon}><Icon size={17} /></span>
                  <span className={classes.planTag}>Contact</span>
                </span>
                <span className={classes.planName}>{plan.name}</span>
                <span className={classes.planPrice}>{plan.price}</span>
                <span className={classes.planDescription}>{plan.description}</span>
                <span className={classes.planFeatures}>
                  {plan.features.map((feature) => (
                    <span className={classes.planFeature} key={feature}><Check size={13} />{feature}</span>
                  ))}
                  <span className={classes.planFeature}><Mail size={13} />Email the DeepVisor team</span>
                </span>
              </a>
            );
          }

          const paidPlanCode = plan.code;

          return (
            <button
              key={plan.code}
              type="button"
              className={`${classes.planCard} ${isSelected ? classes.planSelected : ''}`}
              onClick={() => {
                setSelectedPlan(paidPlanCode);
                setError(null);
              }}
              aria-pressed={isSelected}
            >
              <span className={classes.planTopline}>
                <span className={classes.planIcon}><Icon size={17} /></span>
                <span className={`${classes.planTag} ${plan.popular ? classes.planTagSignal : ''}`}>
                  {isSelected ? 'Selected' : plan.popular ? 'Most selected' : 'Available'}
                </span>
              </span>
              <span className={classes.planName}>{plan.name}</span>
              <span className={classes.planPrice}>{plan.price}</span>
              <span className={classes.planDescription}>{plan.description}</span>
              <span className={classes.planFeatures}>
                {plan.features.map((feature) => (
                  <span className={classes.planFeature} key={feature}><Check size={13} />{feature}</span>
                ))}
              </span>
            </button>
          );
        })}
      </section>

      <section className={classes.comparison} aria-labelledby="plan-comparison-heading">
        <div className={classes.sectionHeading}>
          <h3 id="plan-comparison-heading">Plan comparison</h3>
          <p>Account limits and access at a glance.</p>
        </div>
        <div className={classes.tableWrap}>
          <table className={classes.comparisonTable}>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Starter</th>
                <th scope="col">Growth</th>
                <th scope="col">Premium</th>
                <th scope="col">Managed</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(([capability, ...values]) => (
                <tr key={capability}>
                  <td>{capability}</td>
                  {values.map((value, index) => <td key={`${capability}-${index}`}>{value}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error ? (
        <div className={classes.inlineAlert} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {selectedPlanDetails ? (
        <div className={classes.checkoutBar}>
          <div>
            <span>Selected plan</span>
            <strong>{selectedPlanDetails.name} - {selectedPlanDetails.price}</strong>
          </div>
          <Button
            className={classes.checkoutButton}
            loading={isLoading}
            disabled={isLoading}
            rightSection={<ArrowRight size={16} />}
            onClick={handleCheckout}
          >
            Continue to checkout
          </Button>
        </div>
      ) : null}
    </LegacyAuthFrame>
  );
}
