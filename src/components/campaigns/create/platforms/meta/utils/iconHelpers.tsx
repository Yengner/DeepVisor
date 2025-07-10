import {
  IconTarget,
  IconBrandFacebook,
  IconCurrencyDollar,
  IconUsers,
  IconPhoto,
  IconClipboardCheck,
  IconSettings,
  IconBrandAirtable,
  IconArrowRight,
  IconMessageCircle,
  IconForms,
  IconDeviceMobile,
  IconShoppingCart
} from '@tabler/icons-react';
import React from 'react';
import { CAMPAIGN_OBJECTIVES } from './objectiveMappings';

/**
 * Returns the appropriate icon component for a campaign builder step
 * 
 * @param step - Step index in the campaign creation flow
 * @returns React icon component
 */
export function getStepIcon(step: number): React.ReactNode {
  switch (step) {
    case 0: return <IconTarget size={22} />; // Campaign Objective
    case 1: return <IconSettings size={22} />; // Campaign Details
    case 2: return <IconUsers size={22} />; // Ad Set (Audience targeting)
    case 3: return <IconPhoto size={22} />; // Creative Assets
    case 4: return <IconClipboardCheck size={22} />; // Review
    default: return <IconBrandFacebook size={22} />;
  }
}

export function getObjectiveIcon(objective: string): React.ReactNode {
  switch (objective) {
    case CAMPAIGN_OBJECTIVES.AWARENESS:
      return <IconBrandAirtable size={22} />;
    case CAMPAIGN_OBJECTIVES.TRAFFIC:
      return <IconArrowRight size={22} />;
    case CAMPAIGN_OBJECTIVES.ENGAGEMENT:
      return <IconMessageCircle size={22} />;
    case CAMPAIGN_OBJECTIVES.LEADS:
      return <IconForms size={22} />;
    case CAMPAIGN_OBJECTIVES.APP_PROMOTION:
      return <IconDeviceMobile size={22} />;
    case CAMPAIGN_OBJECTIVES.SALES:
      return <IconShoppingCart size={22} />;
    default:
      return <IconArrowRight size={22} />;
  }
};
