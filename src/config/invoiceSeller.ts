import { BCA_SUPPORT_EMAIL } from "@/config/businessContact";

/**
 * Who issues coach invoices, and the VAT wording. One place, so changing the
 * issuing company or the wording changes every invoice and the Billing page.
 */
export const INVOICE_SELLER = {
  brand: "Business Coach Academy",
  name: "Business Coach International Limited",
  addressLines: [
    "Rm 22B, 22/F Kiu Yin Commercial Building",
    "361-363 Lockhart Road, Wanchai",
    "Hong Kong",
  ],
  companyNumber: "3184304",
  registeredIn: "Hong Kong",
  address:
    "Rm 22B, 22/F Kiu Yin Commercial Building, 361-363 Lockhart Road, Wanchai, Hong Kong",
  email: BCA_SUPPORT_EMAIL,
  website: "businesscoachacademy.com",
} as const;

/** Takes the payments as agent for the seller, under the Sales Agency Agreement of 24 Aug 2022. */
export const INVOICE_COLLECTOR = "Business Coach Academy Limited";

export const INVOICE_VAT_NOTE = `No VAT has been charged. Payment was collected by ${INVOICE_COLLECTOR}, our UK payment company, which has not reached the VAT registration threshold.`;
