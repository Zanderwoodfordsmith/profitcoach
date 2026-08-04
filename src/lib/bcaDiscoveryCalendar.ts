/**
 * BCA marketing / discovery (15-Minute Fit Call) calendar on ProCoach Platform.
 * Same widget as businesscoachacademy.com — not a per-coach embed.
 */

export const BCA_DISCOVERY_CALENDAR_ID = "CzPQ7FEx50ufSbM4rUEy";

export const BCA_DISCOVERY_BOOKING_BASE =
  `https://link.procoachplatform.com/widget/booking/${BCA_DISCOVERY_CALENDAR_ID}`;

export const BCA_DISCOVERY_EMBED_SCRIPT =
  "https://link.procoachplatform.com/js/form_embed.js";

/** Full GHL embed HTML (iframe + resize script), for CalendarEmbed or storage later. */
export const BCA_DISCOVERY_CALENDAR_EMBED_CODE =
  `<iframe src="${BCA_DISCOVERY_BOOKING_BASE}" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="${BCA_DISCOVERY_CALENDAR_ID}"></iframe><br><script src="${BCA_DISCOVERY_EMBED_SCRIPT}" type="text/javascript"></script>`;
