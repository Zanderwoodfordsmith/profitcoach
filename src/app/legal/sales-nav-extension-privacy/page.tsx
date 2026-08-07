import { redirect } from "next/navigation";

/** Legacy URL — extension renamed to Profit Coach for LinkedIn. */
export default function SalesNavExtensionPrivacyRedirect() {
  redirect("/legal/linkedin-extension-privacy");
}
