export type CallRow = {
  id: string;
  contact_id: string | null;
  coach_id: string | null;
  coach_name: string | null;
  coach_business_name: string | null;
  prospect_name: string;
  prospect_email: string | null;
  prospect_phone: string | null;
  business_name: string | null;
  calendar_name: string | null;
  title: string | null;
  status_normalized: string;
  status_raw: string | null;
  start_time: string | null;
  end_time: string | null;
  match_status: string;
};
