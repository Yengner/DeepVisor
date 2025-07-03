import {
  IconTarget,
  IconBrandFacebook,
  IconCurrencyDollar,
  IconMapPin,
  IconPhoto,
  IconCheck
} from '@tabler/icons-react';

export function getStepIcon(step) {
  switch (step) {
    case 0: return <IconTarget size={18} />;
    case 1: return <IconBrandFacebook size={18} />;
    case 2: return <IconCurrencyDollar size={18} />;
    case 3: return <IconMapPin size={18} />;
    case 4: return <IconPhoto size={18} />;
    case 5: return <IconTarget size={18} />;
    case 6: return <IconCheck size={18} />;
    default: return null;
  }
}