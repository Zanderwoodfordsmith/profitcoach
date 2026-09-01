import { GrowthSystemMap } from "@/components/academy/GrowthSystemMap";
import { buildGrowthSystemMap } from "@/lib/academy/growthSystemMap";

export default function AdminGrowthSystemPage() {
  return <GrowthSystemMap sections={buildGrowthSystemMap("/admin/academy/classroom")} />;
}
