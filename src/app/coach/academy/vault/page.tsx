import { VaultCatalogGrid } from "@/components/academy/VaultCatalogGrid";

const BASE = "/coach/academy/vault";

export default function CoachAcademyVaultCatalogPage() {
  return <VaultCatalogGrid basePath={BASE} />;
}
