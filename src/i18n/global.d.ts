import type en from '../../messages/en.json';
import type { Locale } from './locales';

// Message keys are typed from the English catalog; the catalog test keeps Spanish identical in shape.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
