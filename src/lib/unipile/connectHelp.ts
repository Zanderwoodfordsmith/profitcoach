/**
 * What to tell a coach when connecting an account fails. The sign-in happens
 * on Unipile's page, so we only learn that it failed and for which platform.
 * Instagram in particular blocks sign-ins after a few tries in a short time
 * ("too many attempts"), and trying again straight away keeps it blocked.
 */

export const INSTAGRAM_CONNECT_TIP =
  "Before you connect: open the Instagram app on your phone so you can approve the sign-in, and use your Instagram username and password (not Log in with Facebook). Try once. Instagram blocks sign-ins for a while after a few tries close together.";

export function connectFailedMessage(provider: string | null | undefined): string {
  switch ((provider ?? "").toUpperCase()) {
    case "INSTAGRAM":
      return "Instagram stopped the sign-in. That usually means too many tries in a short time, or Instagram wants to check it's you. Open the Instagram app, approve any \"Was this you?\" prompt, wait about an hour, then try once more. Still stuck? Message BCA support and we'll look at it with you.";
    case "MESSENGER":
      return "Facebook stopped the sign-in. Open Facebook on your phone, approve any \"Was this you?\" prompt, wait a few minutes, then try once more.";
    case "LINKEDIN":
      return "LinkedIn didn't connect. Check you used your LinkedIn password (not your Google or Outlook one), approve any check in the LinkedIn app, then try again.";
    case "WHATSAPP":
      return "WhatsApp didn't connect. Open WhatsApp on your phone, go to Linked devices, and scan the code again.";
    default:
      return "Connection failed. Try again.";
  }
}
