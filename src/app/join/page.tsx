import { redirect } from "next/navigation";

/**
 * Programme join: default to the £9,900 pay-in-full checkout page.
 * After pay → /welcome?session_id=… (create account + auto sign-in).
 */
export default async function ProgramJoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.append(key, value);
    else value?.forEach((v) => params.append(key, v));
  }
  const qs = params.toString();
  redirect(qs ? `/join/9900?${qs}` : "/join/9900");
}
