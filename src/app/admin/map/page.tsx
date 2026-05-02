import { CommunityMembersMap } from "@/components/community/CommunityMembersMap";
import { StickyPageHeader } from "@/components/layout";

export default function AdminMapPage() {
  return (
    <>
      <StickyPageHeader
        title="Members map"
        description="See where coaches and admins in the community are based. Click a pin to view their details."
      />
      <CommunityMembersMap />
    </>
  );
}
