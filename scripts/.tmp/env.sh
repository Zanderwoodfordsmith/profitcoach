export SB_URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- | tr -d "'\"")"
export SB_KEY="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d "'\"")"
