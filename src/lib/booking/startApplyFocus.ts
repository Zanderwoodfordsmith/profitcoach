/** Scroll to the /start Let’s Talk panel and highlight the phone field. */

export const START_APPLY_FOCUS_EVENT = "bca:start-apply-focus";

export function focusStartApply() {
  if (typeof window === "undefined") return;

  const apply = document.getElementById("apply");
  if (apply) {
    apply.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    window.location.hash = "apply";
  }

  window.dispatchEvent(new CustomEvent(START_APPLY_FOCUS_EVENT));
}
