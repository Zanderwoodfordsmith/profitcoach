import { VaultCatalogGrid } from "@/components/academy/VaultCatalogGrid";

const BASE = "/admin/academy/vault";

export default function AdminAcademyVaultCatalogPage() {
  return <VaultCatalogGrid basePath={BASE} />;
}
