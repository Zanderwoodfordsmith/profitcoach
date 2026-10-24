import type { SimClient } from "./types";

/**
 * A client's picture. Custom clients get a generated portrait once there's
 * image budget; until then, a soft navy disc with their initials, in the
 * same misty look as the cast.
 */
export function faceOf(client: Pick<SimClient, "face" | "name">): string {
  if (client.face) return client.face;
  const initials = client.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><radialGradient id="g" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#5d7fa6"/><stop offset=".55" stop-color="#1f3d5f"/><stop offset="1" stop-color="#0b2139"/></radialGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="236" text-anchor="middle" font-family="Figtree, system-ui, sans-serif" font-size="128" font-weight="300" fill="#f4eee4" letter-spacing="-4">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const CUSTOM_PREFIX = "c-";

export function isCustomId(id: string): boolean {
  return id.startsWith(CUSTOM_PREFIX);
}
