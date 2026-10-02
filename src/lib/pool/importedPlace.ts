function trim(value: string | null | undefined): string | null {
  const next = (value ?? "").trim();
  return next || null;
}

function alreadyHas(haystack: string, needle: string): boolean {
  const compact = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  return compact(haystack).includes(compact(needle));
}

/**
 * Turn mapped CSV columns into the location string and address the pool
 * already filters on. Town and postcode are folded into location so city
 * and postcode filters work without new columns.
 */
export function composeImportedPlace(input: {
  location?: string | null;
  city?: string | null;
  postcode?: string | null;
  address?: string | null;
}): { location: string | null; address: string | null } {
  const address = trim(input.address);
  const city = trim(input.city);
  const postcode = trim(input.postcode);
  let location = trim(input.location) ?? "";

  if (city && !alreadyHas(location, city)) {
    location = location ? `${location}, ${city}` : city;
  }
  if (postcode && !alreadyHas(location, postcode)) {
    location = location ? `${location}, ${postcode}` : postcode;
  }
  if (!location && address) location = address;

  return {
    location: location || null,
    address,
  };
}
