import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import beyondleanRedirects from "./content/beyondlean/redirects.json";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/**
 * Paul Swift's site on his own domain. Off until NEXT_PUBLIC_BEYONDLEAN_DOMAIN is set (e.g. "www.beyondlean.com");
 * then beyondlean.com serves /beyondlean/* at its root, his old page addresses 301 to the new pages, and
 * theprofitcoach.com/beyondlean/* 301s across to his domain. Files (anything with an extension) are left alone, so
 * images under /beyondlean/ keep working on both hosts.
 */
const BEYONDLEAN_DOMAIN = process.env.NEXT_PUBLIC_BEYONDLEAN_DOMAIN;
const BEYONDLEAN_HOST = [{ type: "host" as const, value: "(www\\.)?beyondlean\\.com" }];
const NOT_A_FILE = "(?!.*\\.[a-zA-Z0-9]{2,5}$)";

function beyondleanDomainRedirects() {
  if (!BEYONDLEAN_DOMAIN) return [];
  const old = Object.entries(beyondleanRedirects.redirects).map(([source, to]) => ({
    source,
    destination: to.replace(/^\/beyondlean/, "") || "/",
    permanent: true,
    has: BEYONDLEAN_HOST,
  }));
  return [
    ...old,
    // Any other old page goes to the home page
    { source: "/:page(.+\\.html)", destination: "/", permanent: true, has: BEYONDLEAN_HOST },
    // Links that still carry the preview prefix
    { source: "/beyondlean", destination: "/", permanent: true, has: BEYONDLEAN_HOST },
    { source: `/beyondlean/:path(${NOT_A_FILE}.*)`, destination: "/:path", permanent: true, has: BEYONDLEAN_HOST },
    // The preview on theprofitcoach.com moves to Paul's domain
    { source: "/beyondlean", destination: `https://${BEYONDLEAN_DOMAIN}/`, permanent: true, missing: BEYONDLEAN_HOST },
    {
      source: `/beyondlean/:path(${NOT_A_FILE}.*)`,
      destination: `https://${BEYONDLEAN_DOMAIN}/:path`,
      permanent: true,
      missing: BEYONDLEAN_HOST,
    },
  ];
}

function beyondleanDomainRewrites() {
  if (!BEYONDLEAN_DOMAIN) return [];
  return [
    { source: "/", destination: "/beyondlean", has: BEYONDLEAN_HOST },
    { source: "/sitemap.xml", destination: "/beyondlean/sitemap.xml", has: BEYONDLEAN_HOST },
    { source: "/robots.txt", destination: "/beyondlean/robots.txt", has: BEYONDLEAN_HOST },
    {
      source: `/:path((?!_next/|api/|beyondlean(?:/|$))${NOT_A_FILE}.+)`,
      destination: "/beyondlean/:path",
      has: BEYONDLEAN_HOST,
    },
  ];
}

const nextConfig: NextConfig = {
  experimental: {
    viewTransition: true,
    proxyClientMaxBodySize: "50mb",
  },
  turbopack: {
    root: process.cwd(),
  },
  // The AI agent reads its context (content/agent and the canon it references) at runtime.
  outputFileTracingIncludes: {
    "/api/agent/**": [
      "./content/agent/**/*",
      "./content/ai-knowledge/**/*",
      "./content/practice-skills/**/*",
    ],
    "/api/coach/sales-call/**": ["./content/agent/references/**/*"],
  },
  // Routes that read files by a runtime path (Ava, practice flow) make tracing pull in the whole
  // project, videos included, which takes functions over Vercel's 250 MB limit. No server code
  // reads these folders (only public/theprofitcoach-mirror is read at runtime).
  outputFileTracingExcludes: {
    "/**": [
      "./public/tutorials/**/*",
      "./public/membership/**/*",
      "./public/beyondlean/**/*",
      "./public/academy/**/*",
      "./public/resources/**/*",
      "./public/site-v4/**/*",
      "./scrollcraft/**/*",
      "./extensions/**/*",
      "./scripts/**/*",
    ],
  },
  async rewrites() {
    return {
      // The homepage is the Scrollcraft build (copied into public/site-v4 at build time).
      // beforeFiles so it wins over src/app/page.tsx.
      beforeFiles: [
        // Paul's domain first, so beyondlean.com/ doesn't get the BCA homepage
        ...beyondleanDomainRewrites(),
        { source: "/", destination: "/site-v4/index.html" },
        { source: "/our-story", destination: "/site-v4/our-story.html" },
        { source: "/profit-system", destination: "/site-v4/profit-system.html" },
      ],
    };
  },
  async redirects() {
    return [
      ...beyondleanDomainRedirects(),
      {
        source: "/academy",
        destination: "/new-academy",
        permanent: false,
      },
      {
        source: "/zoom-zander",
        destination: "https://us02web.zoom.us/j/9183502510",
        permanent: false,
      },
      {
        source: "/zoom-pam",
        destination: "https://us02web.zoom.us/j/7540888016",
        permanent: false,
      },
      {
        source: "/boss-exact/BOSS Assessment.html",
        destination: "/boss-exact/boss-assessment.html",
        permanent: true,
      },
      {
        // The Profile Optimizer now lives in the Blueprint's LinkedIn page.
        source: "/coach/linkedin-profile",
        destination: "/coach/blueprint/linkedin",
        permanent: false,
      },
      {
        source: "/admin/linkedin-profile",
        destination: "/admin/blueprint/coach/linkedin",
        permanent: false,
      },
      {
        // 4 Nov: Story & Proof, Your Voice and Practice Setup are one About You page.
        source: "/coach/blueprint/:page(story|voice|setup)",
        destination: "/coach/blueprint/about",
        permanent: false,
      },
      {
        source: "/admin/blueprint/coach/:page(story|voice|setup)",
        destination: "/admin/blueprint/coach/about",
        permanent: false,
      },
      {
        source: "/coach/practice",
        destination: "/coach/blueprint",
        permanent: false,
      },
      {
        source: "/coach/practice/:path*",
        destination: "/coach/blueprint/:path*",
        permanent: false,
      },
      {
        // Today is hidden from coaches while it's redesigned; admins have it under Tools and links.
        source: "/coach/today",
        destination: "/coach/conversations",
        permanent: false,
      },
      {
        // My Actions was removed; each lesson keeps its own actions.
        source: "/coach/signature/actions",
        destination: "/coach/academy/classroom",
        permanent: false,
      },
      {
        source: "/admin/signature/actions",
        destination: "/admin/academy/classroom",
        permanent: false,
      },
      {
        // Pushed action plans and coach groups were removed.
        source: "/admin/action-plans/:path*",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/coach-groups/:path*",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/coach/workshop",
        destination: "/coach/boss-pro",
        permanent: true,
      },
      {
        source: "/admin/workshop",
        destination: "/admin/boss-pro",
        permanent: true,
      },
      {
        source: "/my-network",
        destination:
          "https://www.linkedin.com/sales/search/people?query=(recentSearchParam%3A(id%3A5952814412%2CdoLogHistory%3Atrue)%2Cfilters%3AList((type%3ACURRENT_COMPANY%2Cvalues%3AList((text%3Acoach%2CselectionType%3AEXCLUDED)%2C(text%3Acoaching%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultant%2CselectionType%3AEXCLUDED)%2C(text%3Aconsulting%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultants%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultancy%2CselectionType%3AEXCLUDED)%2C(text%3Apsychologist)%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiter%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiting%2CselectionType%3AEXCLUDED)%2C(text%3Arecruitment%2CselectionType%3AEXCLUDED)%2C(text%3Arecruit%2CselectionType%3AEXCLUDED)))%2C(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AB%2Ctext%3A1-10%2CselectionType%3AINCLUDED)%2C(id%3AC%2Ctext%3A11-50%2CselectionType%3AINCLUDED)%2C(id%3AD%2Ctext%3A51-200%2CselectionType%3AINCLUDED)))%2C(type%3ARELATIONSHIP%2Cvalues%3AList((id%3AF%2Ctext%3A1st%2520degree%2520connections%2CselectionType%3AINCLUDED)))%2C(type%3ACURRENT_TITLE%2Cvalues%3AList((text%3AOwner%2CselectionType%3AINCLUDED)%2C(text%3Aco-owner%2CselectionType%3AINCLUDED)%2C(text%3Afounder%2CselectionType%3AINCLUDED)%2C(text%3Aco-founder%2CselectionType%3AINCLUDED)%2C(text%3ACEO%2CselectionType%3AINCLUDED)%2C(text%3AManaging%2520director%2CselectionType%3AINCLUDED)%2C(text%3Aco-managing%2520director%2CselectionType%3AINCLUDED)%2C(text%3AManaging%2520partner%2CselectionType%3AINCLUDED)%2C(text%3Aco-managing%2520partner%2CselectionType%3AINCLUDED)%2C(text%3Acoach%2CselectionType%3AEXCLUDED)%2C(text%3Acoaching%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultant%2CselectionType%3AEXCLUDED)%2C(text%3Aconsulting%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultants%2CselectionType%3AEXCLUDED)%2C(text%3Apsychologist%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiter%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiting%2CselectionType%3AEXCLUDED)%2C(text%3Arecruitment%2CselectionType%3AEXCLUDED)%2C(text%3Arecruit%2CselectionType%3AEXCLUDED)))))&sessionId=l2w73pTkQgKO2LFJNeru5w%3D%3D&viewAllFilters=true",
        permanent: false,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
