import { redirect } from "next/navigation";

/** Vault courses now sit inside Classroom, under "The Vault". */
export default function AdminAcademyVaultCatalogPage() {
  redirect("/admin/academy/classroom#vault");
}
