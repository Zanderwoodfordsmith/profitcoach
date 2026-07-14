import type { ProspectRow } from "@/lib/prospectRow";
import type { UpdatedProspectFields } from "@/lib/prospects/updateProspectFields";

/** Merge PATCH response fields onto a local prospect row (client-safe). */
export function applyProspectPatch(
  row: ProspectRow,
  body: UpdatedProspectFields
): ProspectRow {
  return {
    ...row,
    full_name: body.full_name,
    email: body.email,
    phone: body.phone,
    job_title: body.job_title,
    business_name: body.business_name,
    prospect_status: body.prospect_status,
    status: body.status,
    next_action: body.next_action,
    crm_contact_id: body.crm_contact_id,
  };
}
