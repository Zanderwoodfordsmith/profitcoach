import { BEYONDLEAN_DOMAIN } from "@/components/beyondlean/data";

/** robots.txt for beyondlean.com (next.config.ts serves it at /robots.txt on that domain). */
export function GET() {
  const body = BEYONDLEAN_DOMAIN
    ? `User-agent: *\nAllow: /\n\nSitemap: https://${BEYONDLEAN_DOMAIN}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
