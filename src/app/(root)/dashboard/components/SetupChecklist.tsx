import Link from 'next/link';
import { IconArrowRight, IconCircleCheck, IconCircleDashed, IconClock } from '@tabler/icons-react';
import SpiderMascot from '@/components/brand/SpiderMascot';
import classes from './SetupChecklist.module.css';

type ChecklistState = 'done' | 'todo' | 'later';

type ChecklistItem = {
  key: string;
  title: string;
  detail: string;
  state: ChecklistState;
  href?: string;
  action?: string;
  /** Optional items never count toward "steps left". */
  optional?: boolean;
};

type SetupChecklistProps = {
  /** True when a Meta integration exists but no ad account has been chosen yet. */
  metaConnectedWithoutAccount: boolean;
};

const STATE_LABEL: Record<ChecklistState, string> = {
  done: 'Done',
  todo: 'To do',
  later: 'Coming soon',
};

function StateIcon({ state }: { state: ChecklistState }) {
  if (state === 'done') return <IconCircleCheck size={20} aria-hidden />;
  if (state === 'later') return <IconClock size={20} aria-hidden />;
  return <IconCircleDashed size={20} aria-hidden />;
}

/**
 * First-run Overview when no Meta ad account is selected. Every state is factual:
 * onboarding is complete to reach this page; Meta status comes from the saved integration.
 */
export default function SetupChecklist({ metaConnectedWithoutAccount }: SetupChecklistProps) {
  const items: ChecklistItem[] = [
    {
      key: 'profile',
      title: 'Business details',
      detail: 'Saved. You can update them any time.',
      state: 'done',
      href: '/settings#workspace',
      action: 'Edit details',
    },
    metaConnectedWithoutAccount
      ? {
          key: 'meta',
          title: 'Choose your Meta ad account',
          detail: 'Meta is connected. Pick the ad account DeepVisor should read.',
          state: 'todo',
          href: '/integration',
          action: 'Choose account',
        }
      : {
          key: 'meta',
          title: 'Connect Meta',
          detail: 'See your spend, results, and decisions from Facebook and Instagram ads.',
          state: 'todo',
          href: '/integration',
          action: 'Connect Meta',
        },
    {
      key: 'extras',
      title: 'Add your website and what you offer',
      detail: 'Optional. Helps DeepVisor describe your business accurately.',
      state: 'todo',
      href: '/settings#workspace',
      action: 'Add details',
      optional: true,
    },
    {
      key: 'tour',
      title: 'Take the product tour',
      detail: 'A short walkthrough of Overview, Decisions, and Campaigns.',
      state: 'later',
    },
  ];
  const remaining = items.filter((item) => item.state === 'todo' && !item.optional).length;

  return (
    <section className={classes.checklist} aria-labelledby="setup-checklist-title">
      <header className={classes.header}>
        <SpiderMascot state="idle" size={64} />
        <div>
          <h1 id="setup-checklist-title">Finish setting up</h1>
          <p>
            {remaining === 1 ? '1 step left' : `${remaining} steps left`} before your advertising shows up here.
          </p>
        </div>
      </header>

      <ol className={classes.items}>
        {items.map((item) => (
          <li key={item.key} className={classes.item} data-state={item.state}>
            <span className={classes.icon}><StateIcon state={item.state} /></span>
            <div className={classes.text}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            {item.href && item.action ? (
              <Link href={item.href} className={classes.action}>
                {item.action}
                <IconArrowRight size={15} aria-hidden />
              </Link>
            ) : (
              <span className={classes.status}>{STATE_LABEL[item.state]}</span>
            )}
            <span className={classes.srOnly}>Status: {STATE_LABEL[item.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
