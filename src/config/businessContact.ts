/** BCA support phone in E.164 format (no spaces). */
export const BCA_BUSINESS_PHONE_E164 = "+447897024555";

/** Human-readable UK display format for the support line. */
export const BCA_BUSINESS_PHONE_DISPLAY = "+44 7897 024 555";

/** Short link that opens a WhatsApp chat with BCA. */
export const BCA_WHATSAPP_URL = "https://businesscoachacademy.com/whatsup";

export const BCA_SUPPORT_EMAIL = "support@businesscoachacademy.com";

export const BCA_BUSINESS_CONTACT = {
  phoneE164: BCA_BUSINESS_PHONE_E164,
  phoneDisplay: BCA_BUSINESS_PHONE_DISPLAY,
  phoneTelHref: `tel:${BCA_BUSINESS_PHONE_E164}`,
  phoneLine: `Call or WhatsApp on ${BCA_BUSINESS_PHONE_DISPLAY}`,
  whatsAppHref: BCA_WHATSAPP_URL,
  email: BCA_SUPPORT_EMAIL,
  emailHref: `mailto:${BCA_SUPPORT_EMAIL}`,
} as const;
