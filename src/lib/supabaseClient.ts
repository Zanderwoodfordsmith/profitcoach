import { createClient } from "@supabase/supabase-js";
import { writeSessionCookie } from "@/lib/auth/sessionCookie";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase client is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local."
  );
}

export const supabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

// Mirror the session into a cookie for the server (see sessionCookie.ts).
// Fires on load (INITIAL_SESSION), sign-in, token refresh and sign-out.
if (typeof window !== "undefined") {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    writeSessionCookie(session);
  });
}
