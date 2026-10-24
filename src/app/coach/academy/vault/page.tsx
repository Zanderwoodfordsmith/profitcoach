import { redirect } from "next/navigation";

/** Vault courses now sit inside Classroom, under "The Vault". */
export default function CoachAcademyVaultCatalogPage() {
  redirect("/coach/academy/classroom#vault");
}
