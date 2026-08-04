/** LinkedIn Sales Navigator REGION ids (UK counties / cities). */

export type SalesNavRegion = { id: string; text: string };

export const SALES_NAV_UK_COUNTIES: Array<SalesNavRegion & { label: string }> = [
  { label: "Hertfordshire", id: "103872123", text: "Hertfordshire" },
  { label: "Essex", id: "102575666", text: "Essex" },
  { label: "Surrey", id: "100174442", text: "Surrey" },
  { label: "Kent", id: "104099753", text: "Kent" },
  { label: "Buckinghamshire", id: "104058239", text: "Buckinghamshire" },
  { label: "Cambridgeshire", id: "100173647", text: "Cambridgeshire" },
  { label: "Oxfordshire", id: "104058253", text: "Oxfordshire" },
  { label: "Bedfordshire", id: "104058234", text: "Bedfordshire" },
  { label: "Suffolk", id: "104099802", text: "Suffolk" },
  { label: "Norfolk", id: "104099762", text: "Norfolk" },
  { label: "Greater London", id: "90009496", text: "Greater London" },
  { label: "Manchester", id: "102426767", text: "Manchester" },
  { label: "Yorkshire", id: "104455622", text: "Yorkshire" },
  { label: "Bristol", id: "101165607", text: "Bristol" },
  { label: "Birmingham", id: "104097009", text: "Birmingham" },
];

/** Postcode prefix → nearest Sales Nav region (approximate). */
export const SALES_NAV_POSTCODE_REGIONS: Record<string, SalesNavRegion> = {
  AL: { id: "103872123", text: "Hertfordshire" },
  SG: { id: "103872123", text: "Hertfordshire" },
  HP: { id: "104058239", text: "Buckinghamshire" },
  CM: { id: "102575666", text: "Essex" },
  SS: { id: "102575666", text: "Essex" },
  CO: { id: "102575666", text: "Essex" },
  IG: { id: "102575666", text: "Essex" },
  RM: { id: "102575666", text: "Essex" },
  KT: { id: "100174442", text: "Surrey" },
  RH: { id: "100174442", text: "Surrey" },
  GU: { id: "100174442", text: "Surrey" },
  CR: { id: "100174442", text: "Surrey" },
  SM: { id: "100174442", text: "Surrey" },
  TW: { id: "100174442", text: "Surrey" },
  ME: { id: "104099753", text: "Kent" },
  TN: { id: "104099753", text: "Kent" },
  DA: { id: "104099753", text: "Kent" },
  BR: { id: "104099753", text: "Kent" },
  CT: { id: "104099753", text: "Kent" },
  CB: { id: "100173647", text: "Cambridgeshire" },
  OX: { id: "104058253", text: "Oxfordshire" },
  MK: { id: "104058234", text: "Bedfordshire" },
  LU: { id: "104058234", text: "Bedfordshire" },
  IP: { id: "104099802", text: "Suffolk" },
  NR: { id: "104099762", text: "Norfolk" },
  PE: { id: "104099762", text: "Norfolk" },
  E: { id: "90009496", text: "Greater London" },
  N: { id: "90009496", text: "Greater London" },
  NW: { id: "90009496", text: "Greater London" },
  W: { id: "90009496", text: "Greater London" },
  SW: { id: "90009496", text: "Greater London" },
  SE: { id: "90009496", text: "Greater London" },
  EC: { id: "90009496", text: "Greater London" },
  WC: { id: "90009496", text: "Greater London" },
  M: { id: "102426767", text: "Manchester" },
  SK: { id: "102426767", text: "Manchester" },
  WA: { id: "102426767", text: "Manchester" },
  OL: { id: "102426767", text: "Manchester" },
  BL: { id: "102426767", text: "Manchester" },
  B: { id: "104097009", text: "Birmingham" },
  BS: { id: "101165607", text: "Bristol" },
};

export function resolvePostcodeRegion(raw: string): SalesNavRegion | null {
  const postcode = raw.trim().toUpperCase().replace(/[0-9\s]/g, "");
  if (!postcode) return null;
  return (
    SALES_NAV_POSTCODE_REGIONS[postcode] ??
    SALES_NAV_POSTCODE_REGIONS[postcode[0]!] ??
    null
  );
}
