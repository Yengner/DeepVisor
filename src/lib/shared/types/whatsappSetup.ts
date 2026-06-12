export type WhatsAppNumberSource =
  | 'page_phone_confirmed'
  | 'manual'
  | 'skipped'
  | 'not_available';

export type WhatsAppSetupResult = {
  pagePhone: string | null;
  whatsappNumber: string | null;
  whatsappNumberSource: WhatsAppNumberSource;
  whatsappSetupCompleted: boolean;
};

export type ConfiguredWhatsAppNumber = {
  id: string;
  display_phone_number: string;
  label?: string;
  pageName?: string | null;
  pagePictureUrl?: string | null;
  source?: string | null;
};
