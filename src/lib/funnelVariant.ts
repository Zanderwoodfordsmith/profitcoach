import type { ReadonlyURLSearchParams } from "next/navigation";

/** Copy search params for redirect but drop `variant` (not used on /score for now). */
export function searchParamsWithoutVariant(
  searchParams: ReadonlyURLSearchParams | URLSearchParams
): string {
  const sp = new URLSearchParams(searchParams.toString());
  sp.delete("variant");
  const s = sp.toString();
  return s ? `?${s}` : "";
}
