export type CalendarQueueStatus = 'draft' | 'ready' | 'approved';
export type CalendarQueueSource = 'manual' | 'agent' | 'automatic';

export type CalendarQueuePreviewItem = {
  id: string;
  title: string;
  description: string;
  day: string;
  time: string;
  durationMinutes: number;
  channel: string;
  status: CalendarQueueStatus;
  source: CalendarQueueSource;
};

type CalendarQueueSeedTemplate = Omit<CalendarQueuePreviewItem, 'id' | 'day'>;

function toIsoDay(date: Date): string {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(1);
  return next;
}

function parseCalendarQueueTimeToMinutes(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return 12 * 60;
  }

  const hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const suffix = match[3].toUpperCase();
  return (suffix === 'PM' ? hours + 12 : hours) * 60 + minutes;
}

export function compareCalendarQueuePreviewItems(
  left: CalendarQueuePreviewItem,
  right: CalendarQueuePreviewItem
): number {
  if (left.day !== right.day) {
    return left.day.localeCompare(right.day);
  }

  return parseCalendarQueueTimeToMinutes(left.time) - parseCalendarQueueTimeToMinutes(right.time);
}

export function buildCalendarQueuePreviewItems(
  selectedAdAccountName: string | null,
  referenceDate: Date = new Date()
): CalendarQueuePreviewItem[] {
  const monthStart = startOfMonth(referenceDate);
  const monthLength = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0
  ).getDate();
  const accountName = selectedAdAccountName || 'selected ad account';
  const recurringPrimaryByWeekday: Record<number, CalendarQueueSeedTemplate[]> = {
    0: [
      {
        title: 'Weekend pacing check',
        description: 'Automatic weekend guardrail review for spend pacing and lead flow.',
        time: '10:00 AM',
        durationMinutes: 30,
        channel: 'Monitoring',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Weekend CRM quality sweep',
        description: 'Checks whether new weekend leads are syncing into CRM as expected.',
        time: '11:15 AM',
        durationMinutes: 35,
        channel: 'CRM',
        status: 'ready',
        source: 'automatic',
      },
      {
        title: 'Hold weekend spend guardrails',
        description: 'Keeps automated weekend budget caps in place until Monday review.',
        time: '9:30 AM',
        durationMinutes: 25,
        channel: 'Budget',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Review weekend comment queue before Monday',
        description: 'Captures manual owner follow-up items from weekend messages and comments.',
        time: '4:00 PM',
        durationMinutes: 30,
        channel: 'Community',
        status: 'draft',
        source: 'manual',
      },
    ],
    1: [
      {
        title: `Review weekend lead quality in ${accountName}`,
        description: 'Looks at lead quality drift and booking performance after the weekend.',
        time: '8:30 AM',
        durationMinutes: 45,
        channel: 'Analysis',
        status: 'ready',
        source: 'automatic',
      },
      {
        title: `Rebalance Monday launch budget in ${accountName}`,
        description: 'Agent wants to front-load spend into the strongest early-week campaign.',
        time: '9:00 AM',
        durationMinutes: 50,
        channel: 'Budget',
        status: 'ready',
        source: 'agent',
      },
      {
        title: 'Check Monday call-booking quality against CRM',
        description: 'Verifies that booked calls are still matching the best-performing ad sets.',
        time: '10:00 AM',
        durationMinutes: 40,
        channel: 'Attribution',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: `Approve Monday testimonial rotation for ${accountName}`,
        description: 'Manual creative pass before the afternoon demand window opens.',
        time: '11:00 AM',
        durationMinutes: 45,
        channel: 'Creative',
        status: 'draft',
        source: 'manual',
      },
    ],
    2: [
      {
        title: 'Queue creative refresh from owner notes',
        description: 'User-requested creative changes are lined up for the next launch window.',
        time: '9:15 AM',
        durationMinutes: 45,
        channel: 'Creative',
        status: 'draft',
        source: 'manual',
      },
      {
        title: 'Open audience expansion test window',
        description: 'Agent proposes a broader audience test based on strong recent conversions.',
        time: '10:45 AM',
        durationMinutes: 55,
        channel: 'Audience',
        status: 'ready',
        source: 'agent',
      },
      {
        title: 'Review search term waste before noon ramp',
        description: 'Automatic cleanup pass before budget accelerates into the afternoon.',
        time: '11:15 AM',
        durationMinutes: 35,
        channel: 'Search',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Map fresh angle requests from sales calls',
        description: 'Manual intake of objections and language from recent sales conversations.',
        time: '1:00 PM',
        durationMinutes: 40,
        channel: 'Messaging',
        status: 'draft',
        source: 'manual',
      },
    ],
    3: [
      {
        title: 'Apply AI budget shift recommendation',
        description: 'Agent wants to push more spend into the strongest cluster midweek.',
        time: '11:00 AM',
        durationMinutes: 60,
        channel: 'Budget',
        status: 'ready',
        source: 'agent',
      },
      {
        title: 'Midweek landing page friction review',
        description: 'Automatic check for form drop-off and page slowdowns after lunch traffic.',
        time: '10:30 AM',
        durationMinutes: 45,
        channel: 'Funnel',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Prepare midweek offer test queue',
        description: 'Owner-facing offer variant is prepared for approval later in the day.',
        time: '1:15 PM',
        durationMinutes: 45,
        channel: 'Offer',
        status: 'draft',
        source: 'manual',
      },
      {
        title: 'Scale best performing lead form cluster',
        description: 'Agent flags the best midweek segment for a controlled scale-up.',
        time: '9:45 AM',
        durationMinutes: 50,
        channel: 'Budget',
        status: 'ready',
        source: 'agent',
      },
    ],
    4: [
      {
        title: 'Validate CRM quality anomalies',
        description: 'Automatic Thursday pass catches mismatches in lead quality reporting.',
        time: '10:30 AM',
        durationMinutes: 40,
        channel: 'Attribution',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Refresh Thursday retargeting creative',
        description: 'Agent lines up a creative swap before retargeting audiences peak.',
        time: '9:30 AM',
        durationMinutes: 50,
        channel: 'Creative',
        status: 'ready',
        source: 'agent',
      },
      {
        title: 'Protect strongest campaign budget ahead of weekend',
        description: 'Manual note to preserve the best campaign budget before Friday push.',
        time: '2:15 PM',
        durationMinutes: 35,
        channel: 'Budget',
        status: 'draft',
        source: 'manual',
      },
      {
        title: 'Queue sales-team note follow-up for warm traffic',
        description: 'Turns recent owner and sales notes into a concrete warm-audience task.',
        time: '11:45 AM',
        durationMinutes: 35,
        channel: 'Planning',
        status: 'draft',
        source: 'manual',
      },
    ],
    5: [
      {
        title: 'Prepare weekend offer rotation',
        description: 'Agent sets up the offer mix expected to work best over the weekend.',
        time: '9:45 AM',
        durationMinutes: 45,
        channel: 'Offer',
        status: 'draft',
        source: 'agent',
      },
      {
        title: 'Friday pacing reset for strongest ad set',
        description: 'Automatic pacing correction before the account moves into weekend traffic.',
        time: '10:15 AM',
        durationMinutes: 35,
        channel: 'Budget',
        status: 'ready',
        source: 'automatic',
      },
      {
        title: 'Queue testimonial bundle for weekend traffic',
        description: 'Manual creative package prepared for Saturday and Sunday lead volume.',
        time: '12:30 PM',
        durationMinutes: 45,
        channel: 'Creative',
        status: 'draft',
        source: 'manual',
      },
      {
        title: 'Approve weekend lead form simplification',
        description: 'Agent suggests a lighter form flow for higher-volume weekend traffic.',
        time: '1:15 PM',
        durationMinutes: 40,
        channel: 'Funnel',
        status: 'ready',
        source: 'agent',
      },
    ],
    6: [
      {
        title: 'Weekend spend guardrail watch',
        description: 'Automatic Saturday check keeps budget guardrails stable during lighter staffing.',
        time: '11:00 AM',
        durationMinutes: 25,
        channel: 'Monitoring',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Auto-review Saturday comment queue',
        description: 'Automatic review surfaces comment and inbox items that may affect conversions.',
        time: '12:15 PM',
        durationMinutes: 25,
        channel: 'Community',
        status: 'ready',
        source: 'automatic',
      },
      {
        title: 'Weekend landing-page sanity check',
        description: 'Quick weekend QA to confirm forms and analytics are still healthy.',
        time: '1:30 PM',
        durationMinutes: 25,
        channel: 'Funnel',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Review Saturday inbound surge handling',
        description: 'Manual review of inbound load and follow-up timing before Sunday.',
        time: '9:45 AM',
        durationMinutes: 30,
        channel: 'CRM',
        status: 'draft',
        source: 'manual',
      },
    ],
  };

  const recurringSecondaryByWeekday: Partial<Record<number, CalendarQueueSeedTemplate[]>> = {
    1: [
      {
        title: 'Approve retargeting headline swap',
        description: 'Manual creative approval before afternoon warm traffic begins.',
        time: '2:00 PM',
        durationMinutes: 35,
        channel: 'Creative',
        status: 'draft',
        source: 'manual',
      },
      {
        title: 'Queue noon budget cap for strongest ad set',
        description: 'Agent suggests a capped budget increase on the day’s best ad set.',
        time: '1:30 PM',
        durationMinutes: 35,
        channel: 'Budget',
        status: 'ready',
        source: 'agent',
      },
    ],
    2: [
      {
        title: 'Auto-pause weak placement cluster',
        description: 'Automatic rule queues a placement cut after poor efficiency signals.',
        time: '3:15 PM',
        durationMinutes: 25,
        channel: 'Placement',
        status: 'ready',
        source: 'automatic',
      },
      {
        title: 'AI recommends broader lookalike launch',
        description: 'Agent identifies room to test a slightly broader audience segment.',
        time: '2:30 PM',
        durationMinutes: 45,
        channel: 'Audience',
        status: 'ready',
        source: 'agent',
      },
    ],
    3: [
      {
        title: 'Sync CRM lag flags before afternoon traffic',
        description: 'Automatic sync checks for lagging CRM values before the next demand spike.',
        time: '3:00 PM',
        durationMinutes: 25,
        channel: 'CRM',
        status: 'approved',
        source: 'automatic',
      },
      {
        title: 'Review owner notes for Wednesday promo push',
        description: 'Manual planning item based on recent owner requests and promo timing.',
        time: '4:15 PM',
        durationMinutes: 30,
        channel: 'Planning',
        status: 'draft',
        source: 'manual',
      },
    ],
    4: [
      {
        title: 'Automatic alert: rising CPL on cold audience',
        description: 'Automatic alert creates a queue item before the weekend ramp begins.',
        time: '4:00 PM',
        durationMinutes: 20,
        channel: 'Monitoring',
        status: 'ready',
        source: 'automatic',
      },
      {
        title: 'AI recommends tighter geo exclusions',
        description: 'Agent finds a set of geos that should be excluded before Friday spend.',
        time: '3:30 PM',
        durationMinutes: 35,
        channel: 'Audience',
        status: 'ready',
        source: 'agent',
      },
    ],
    5: [
      {
        title: 'Owner requested campaign note cleanup',
        description: 'Manual cleanup task for campaign naming and notes before the weekend.',
        time: '3:45 PM',
        durationMinutes: 25,
        channel: 'Planning',
        status: 'draft',
        source: 'manual',
      },
      {
        title: 'Automatic safeguard before weekend spend',
        description: 'Automatic safety check queues a final weekend budget safeguard.',
        time: '5:00 PM',
        durationMinutes: 20,
        channel: 'Monitoring',
        status: 'approved',
        source: 'automatic',
      },
    ],
  };

  const specialBusyDays: Array<{
    dayOffset: number;
    items: CalendarQueueSeedTemplate[];
  }> = [
    {
      dayOffset: 7,
      items: [
        {
          title: 'Approve revised form hook for spring promo',
          description: 'Manual approval item added before the noon push.',
          time: '8:00 AM',
          durationMinutes: 30,
          channel: 'Creative',
          status: 'draft',
          source: 'manual',
        },
        {
          title: 'Automatic pause on weak placement cluster',
          description: 'Automatic placement guardrail kicks in after midday efficiency drops.',
          time: '1:15 PM',
          durationMinutes: 20,
          channel: 'Placement',
          status: 'ready',
          source: 'automatic',
        },
        {
          title: 'AI build replacement retargeting bundle',
          description: 'Agent assembles a replacement bundle for the best retargeting pocket.',
          time: '5:30 PM',
          durationMinutes: 40,
          channel: 'Creative',
          status: 'ready',
          source: 'agent',
        },
        {
          title: 'Owner note: hold budget until call inventory clears',
          description: 'Manual business note that should stay visible before the next morning.',
          time: '6:15 PM',
          durationMinutes: 20,
          channel: 'Planning',
          status: 'draft',
          source: 'manual',
        },
      ],
    },
    {
      dayOffset: 18,
      items: [
        {
          title: 'Weekend sales sync follow-up',
          description: 'Manual review of owner feedback collected during the weekend.',
          time: '9:15 AM',
          durationMinutes: 25,
          channel: 'Planning',
          status: 'draft',
          source: 'manual',
        },
        {
          title: 'Auto-check lead handoff speed',
          description: 'Automatic latency review for the CRM handoff flow.',
          time: '12:00 PM',
          durationMinutes: 20,
          channel: 'CRM',
          status: 'approved',
          source: 'automatic',
        },
        {
          title: 'Agent proposes Monday budget preload',
          description: 'Agent previews a Monday budget shift based on weekend signals.',
          time: '2:30 PM',
          durationMinutes: 35,
          channel: 'Budget',
          status: 'ready',
          source: 'agent',
        },
        {
          title: 'Review weekend promo comments before launch',
          description: 'Manual cleanup task before Monday promotion copy is locked.',
          time: '4:45 PM',
          durationMinutes: 25,
          channel: 'Community',
          status: 'draft',
          source: 'manual',
        },
      ],
    },
    {
      dayOffset: 23,
      items: [
        {
          title: 'Approve Friday warm-audience spend increase',
          description: 'Manual signoff before the best warm campaign gets more spend.',
          time: '8:15 AM',
          durationMinutes: 25,
          channel: 'Budget',
          status: 'draft',
          source: 'manual',
        },
        {
          title: 'Automatic alert: rising frequency on hero creative',
          description: 'Automatic check surfaces fatigue before the weekend rotation.',
          time: '11:45 AM',
          durationMinutes: 20,
          channel: 'Monitoring',
          status: 'ready',
          source: 'automatic',
        },
        {
          title: 'AI recommends fresh testimonial carousel',
          description: 'Agent lines up a replacement creative unit for weekend traffic.',
          time: '2:10 PM',
          durationMinutes: 35,
          channel: 'Creative',
          status: 'ready',
          source: 'agent',
        },
        {
          title: 'Manual owner request: protect local-service budget',
          description: 'Business owner note kept visible before the weekend pacing reset.',
          time: '4:30 PM',
          durationMinutes: 20,
          channel: 'Planning',
          status: 'draft',
          source: 'manual',
        },
      ],
    },
    {
      dayOffset: 29,
      items: [
        {
          title: 'Approve month-end reporting note for May handoff',
          description: 'Manual note that captures final month-end context before rollover.',
          time: '8:45 AM',
          durationMinutes: 25,
          channel: 'Reporting',
          status: 'draft',
          source: 'manual',
        },
        {
          title: 'Automatic end-of-month pacing safeguard',
          description: 'Automatic month-end rule checks for wasted spend before the reset.',
          time: '12:15 PM',
          durationMinutes: 20,
          channel: 'Monitoring',
          status: 'approved',
          source: 'automatic',
        },
        {
          title: 'AI suggests May launch shortlist',
          description: 'Agent begins queueing the strongest ideas to carry into the next month.',
          time: '2:40 PM',
          durationMinutes: 45,
          channel: 'Planning',
          status: 'ready',
          source: 'agent',
        },
        {
          title: 'Owner note: preserve best converting lead form',
          description: 'Manual reminder to keep the best converting flow live into May.',
          time: '5:30 PM',
          durationMinutes: 20,
          channel: 'Funnel',
          status: 'draft',
          source: 'manual',
        },
      ],
    },
  ];

  const items: CalendarQueuePreviewItem[] = [];
  let itemCounter = 1;

  function pushTemplate(dayOffset: number, template: CalendarQueueSeedTemplate) {
    const day = addDays(monthStart, dayOffset);

    items.push({
      id: `queue-${itemCounter}`,
      day: toIsoDay(day),
      ...template,
    });
    itemCounter += 1;
  }

  for (let dayOffset = 0; dayOffset < monthLength; dayOffset += 1) {
    const weekday = addDays(monthStart, dayOffset).getDay();
    const weekIndex = Math.floor(dayOffset / 7);
    const primaryTemplates = recurringPrimaryByWeekday[weekday];
    const secondaryTemplates = recurringSecondaryByWeekday[weekday];

    pushTemplate(dayOffset, primaryTemplates[weekIndex % primaryTemplates.length]);

    if (secondaryTemplates) {
      pushTemplate(dayOffset, secondaryTemplates[weekIndex % secondaryTemplates.length]);
    }
  }

  specialBusyDays
    .filter((group) => group.dayOffset < monthLength)
    .forEach((group) => {
      group.items.forEach((template) => pushTemplate(group.dayOffset, template));
    });

  return items.sort(compareCalendarQueuePreviewItems);
}
