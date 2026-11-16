/**
 * The WhatsApp group that Announcements posts can also go to.
 * Matched by WhatsApp's group id, which is the same on every member's phone,
 * so it works for whichever admin is posting (Zander or Pam).
 */
export const WHATSAPP_ANNOUNCEMENTS_GROUP = {
  name: "ProCoach Announcements",
  providerId: "447981269644-1617338471@g.us",
} as const;
