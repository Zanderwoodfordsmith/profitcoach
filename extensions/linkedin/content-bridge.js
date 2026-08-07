/**
 * Runs on Profit Coach app origins. Reads Supabase access token from localStorage
 * so the extension popup can call authenticated APIs.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_SUPABASE_ACCESS_TOKEN") return false;

  try {
    const token = findSupabaseAccessToken();
    sendResponse({
      ok: Boolean(token),
      accessToken: token,
      origin: window.location.origin,
    });
  } catch (err) {
    sendResponse({
      ok: false,
      error: err instanceof Error ? err.message : "Could not read session.",
    });
  }
  return false;
});

function findSupabaseAccessToken() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const access =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;
      if (typeof access === "string" && access.length > 20) return access;
    } catch {
      // ignore bad JSON
    }
  }
  return null;
}
