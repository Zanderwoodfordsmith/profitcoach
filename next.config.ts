import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/boss-exact/BOSS Assessment.html",
        destination: "/boss-exact/boss-assessment.html",
        permanent: true,
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
          "https://www.linkedin.com/sales/search/people?query=(recentSearchParam%3A(id%3A5952814412%2CdoLogHistory%3Atrue)%2Cfilters%3AList((type%3ACURRENT_COMPANY%2Cvalues%3AList((text%3Acoach%2CselectionType%3AEXCLUDED)%2C(text%3Acoaching%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultant%2CselectionType%3AEXCLUDED)%2C(text%3Aconsulting%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultants%2CselectionType%3AEXCLUDED)%2C(text%3Apsychologist%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiter%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiting%2CselectionType%3AEXCLUDED)%2C(text%3Arecruitment%2CselectionType%3AEXCLUDED)%2C(text%3Arecruit%2CselectionType%3AEXCLUDED)))%2C(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AB%2Ctext%3A1-10%2CselectionType%3AINCLUDED)%2C(id%3AC%2Ctext%3A11-50%2CselectionType%3AINCLUDED)%2C(id%3AD%2Ctext%3A51-200%2CselectionType%3AINCLUDED)))%2C(type%3AREGION%2Cvalues%3AList((id%3A101165590%2Ctext%3AUnited%2520Kingdom%2CselectionType%3AINCLUDED)))%2C(type%3ARELATIONSHIP%2Cvalues%3AList((id%3AF%2Ctext%3A1st%2520degree%2520connections%2CselectionType%3AINCLUDED)))%2C(type%3ACURRENT_TITLE%2Cvalues%3AList((text%3AOwner%2CselectionType%3AINCLUDED)%2C(text%3Aco-owner%2CselectionType%3AINCLUDED)%2C(text%3Afounder%2CselectionType%3AINCLUDED)%2C(text%3Aco-founder%2CselectionType%3AINCLUDED)%2C(text%3ACEO%2CselectionType%3AINCLUDED)%2C(text%3AManaging%2520director%2CselectionType%3AINCLUDED)%2C(text%3Aco-managing%2520director%2CselectionType%3AINCLUDED)%2C(text%3AManaging%2520partner%2CselectionType%3AINCLUDED)%2C(text%3Aco-managing%2520partner%2CselectionType%3AINCLUDED)%2C(text%3Acoach%2CselectionType%3AEXCLUDED)%2C(text%3Acoaching%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultant%2CselectionType%3AEXCLUDED)%2C(text%3Aconsulting%2CselectionType%3AEXCLUDED)%2C(text%3Aconsultants%2CselectionType%3AEXCLUDED)%2C(text%3Apsychologist%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiter%2CselectionType%3AEXCLUDED)%2C(text%3Arecruiting%2CselectionType%3AEXCLUDED)%2C(text%3Arecruitment%2CselectionType%3AEXCLUDED)%2C(text%3Arecruit%2CselectionType%3AEXCLUDED)))))&sessionId=l2w73pTkQgKO2LFJNeru5w%3D%3D&viewAllFilters=true",
        permanent: false,
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
